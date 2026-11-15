import 'server-only'

import { commitmentVsBudget, grantOverBudget } from '@/lib/erp/commitment-budget'
import { Decimal } from '@/lib/money'
import { toDate, today } from '@/lib/date'
import { budgetVariance, canReceivePledge } from '@/lib/erp/verticals-p5'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import * as paymentService from '@/server/services/payment.service'

export async function listPledges(ctx: OrgContext) {
  return db.donorPledge.findMany({
    where: { orgId: ctx.orgId },
    include: {
      customer: { select: { id: true, displayName: true } },
      trackingCategory: { select: { id: true, name: true } },
      payment: { select: { id: true, number: true, amount: true } },
    },
    orderBy: { pledgedAt: 'desc' },
    take: 200,
  })
}

export async function createPledge(
  ctx: OrgContext,
  input: {
    customerId: string
    amount: string
    pledgedAt?: string
    dueDate?: string | null
    trackingCategoryId?: string | null
    purpose?: string | null
    notes?: string | null
  },
) {
  const customer = await db.customer.findFirst({
    where: { id: input.customerId, orgId: ctx.orgId, isActive: true },
    select: { id: true },
  })
  if (!customer) throw notFound('Donor / customer')

  const amount = new Decimal(input.amount)
  if (amount.lessThanOrEqualTo(0)) throw validation('Pledge amount must be more than zero.')

  if (input.trackingCategoryId) {
    const fund = await db.trackingCategory.findFirst({
      where: { id: input.trackingCategoryId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!fund) throw notFound('Fund / class')
  }

  return db.donorPledge.create({
    data: {
      orgId: ctx.orgId,
      customerId: customer.id,
      amount,
      pledgedAt: toDate(input.pledgedAt ?? today(ctx.organization.timeZone)),
      dueDate: input.dueDate ? toDate(input.dueDate) : null,
      trackingCategoryId: input.trackingCategoryId || null,
      purpose: input.purpose?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  })
}

/** Receive a pledge by posting a customer payment and linking it. */
export async function receivePledge(
  ctx: OrgContext,
  input: { pledgeId: string; depositAccountId: string; date?: string; reference?: string | null },
) {
  const pledge = await db.donorPledge.findFirst({
    where: { id: input.pledgeId, orgId: ctx.orgId },
  })
  if (!pledge) throw notFound('Pledge')
  if (!canReceivePledge(pledge.status)) {
    throw precondition('Only an open pledge can be received.')
  }

  const payment = await paymentService.create(ctx, {
    number: undefined,
    customerId: pledge.customerId,
    date: input.date ?? today(ctx.organization.timeZone),
    amount: pledge.amount.toString(),
    depositAccountId: input.depositAccountId,
    reference: input.reference ?? pledge.purpose ?? undefined,
    memo: `Donor pledge ${pledge.id}`,
    method: 'BANK_TRANSFER',
    applications: [],
    acknowledgeDuplicate: true,
  })

  await db.donorPledge.update({
    where: { id: pledge.id },
    data: { status: 'RECEIVED', paymentId: payment.id },
  })

  return { pledgeId: pledge.id, paymentId: payment.id, paymentNumber: payment.number }
}

export async function grantBudgetReport(ctx: OrgContext, budgetId?: string) {
  const budgets = await db.budget.findMany({
    where: {
      orgId: ctx.orgId,
      ...(budgetId ? { id: budgetId } : {}),
    },
    include: {
      trackingCategory: { select: { id: true, name: true } },
      lines: {
        include: { account: { select: { id: true, code: true, name: true } } },
      },
    },
    orderBy: { startDate: 'desc' },
    take: 20,
  })

  const rows = []
  for (const budget of budgets) {
    let budgeted = new Decimal(0)
    for (const line of budget.lines) budgeted = budgeted.plus(line.amount.toString())

    // Actual: journal lines in period for budget accounts, optionally tagged to fund.
    const accountIds = budget.lines.map((line) => line.accountId)
    let actual = new Decimal(0)
    if (accountIds.length > 0) {
      const aggregates = await db.journalLine.groupBy({
        by: ['accountId'],
        where: {
          orgId: ctx.orgId,
          accountId: { in: accountIds },
          ...(budget.trackingCategoryId
            ? { trackingCategoryId: budget.trackingCategoryId }
            : {}),
          journal: {
            status: 'POSTED',
            date: { gte: budget.startDate, lte: budget.endDate },
          },
        },
        _sum: { debit: true, credit: true },
      })
      for (const row of aggregates) {
        const debit = new Decimal(row._sum.debit?.toString() ?? '0')
        const credit = new Decimal(row._sum.credit?.toString() ?? '0')
        actual = actual.plus(debit.minus(credit).abs())
      }
    }

    rows.push({
      id: budget.id,
      name: budget.name,
      fundId: budget.trackingCategoryId,
      fund: budget.trackingCategory?.name ?? null,
      startDate: budget.startDate.toISOString().slice(0, 10),
      endDate: budget.endDate.toISOString().slice(0, 10),
      budgeted: budgeted.toFixed(2),
      actual: actual.toFixed(2),
      variance: budgetVariance(budgeted.toString(), actual.toString()),
    })
  }

  return rows
}

/** Encumbered open PO vs grant budgets rolled up by fund / class. */
export async function grantFundCommitments(ctx: OrgContext) {
  const [grants, openPos] = await Promise.all([
    grantBudgetReport(ctx),
    db.purchaseDocument.findMany({
      where: {
        orgId: ctx.orgId,
        type: 'PURCHASE_ORDER',
        encumbered: true,
        deletedAt: null,
        status: { in: ['OPEN', 'PARTIAL', 'PENDING_APPROVAL'] },
      },
      select: {
        total: true,
        trackingCategoryId: true,
        trackingCategory: { select: { id: true, name: true } },
      },
    }),
  ])

  const openPoByCategory = new Map<string | null, Decimal>()
  const categoryNames = new Map<string | null, string | null>()
  for (const row of openPos) {
    const key = row.trackingCategoryId
    const prev = openPoByCategory.get(key) ?? new Decimal(0)
    openPoByCategory.set(key, prev.plus(row.total))
    if (key && row.trackingCategory) categoryNames.set(key, row.trackingCategory.name)
    if (!key) categoryNames.set(null, 'Unclassified')
  }

  const budgetByCategory = new Map<string | null, Decimal>()
  const actualByCategory = new Map<string | null, Decimal>()
  for (const row of grants) {
    const key = row.fundId ?? null
    budgetByCategory.set(key, (budgetByCategory.get(key) ?? new Decimal(0)).plus(row.budgeted))
    actualByCategory.set(key, (actualByCategory.get(key) ?? new Decimal(0)).plus(row.actual))
    if (key && row.fund) categoryNames.set(key, row.fund)
  }

  const commitmentRows = commitmentVsBudget({
    openPoByCategory: [...openPoByCategory.entries()].map(([trackingCategoryId, total]) => ({
      trackingCategoryId,
      total: total.toFixed(4),
    })),
    budgetByCategory: [...budgetByCategory.entries()].map(([trackingCategoryId, amount]) => ({
      trackingCategoryId,
      amount: amount.toFixed(4),
    })),
    categoryNames,
  })

  return commitmentRows.map((row) => {
    const actual = actualByCategory.get(row.trackingCategoryId) ?? new Decimal(0)
    const encumbered = new Decimal(row.openPoTotal)
    const budgeted = new Decimal(row.budgetAmount)
    return {
      ...row,
      actual: actual.toFixed(2),
      overBudget: grantOverBudget({
        budgeted: budgeted.toFixed(2),
        actual: actual.toFixed(2),
        encumbered: encumbered.toFixed(2),
      }),
    }
  })
}

/**
 * Fund balance sheet lite: net of posted journal lines tagged to each class
 * (assets / liabilities / equity / income / expense / COGS), single currency.
 */
export async function fundBalanceSheet(ctx: OrgContext) {
  const funds = await db.trackingCategory.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const rows = []
  for (const fund of funds) {
    const lines = await db.journalLine.findMany({
      where: {
        orgId: ctx.orgId,
        trackingCategoryId: fund.id,
        journal: { status: 'POSTED' },
      },
      select: {
        debit: true,
        credit: true,
        account: { select: { type: true } },
      },
      take: 50_000,
    })

    let assets = new Decimal(0)
    let liabilities = new Decimal(0)
    let equity = new Decimal(0)
    let income = new Decimal(0)
    let expense = new Decimal(0)

    for (const line of lines) {
      const net = new Decimal(line.debit.toString()).minus(line.credit.toString())
      switch (line.account.type) {
        case 'ASSET':
          assets = assets.plus(net)
          break
        case 'LIABILITY':
          liabilities = liabilities.plus(net.negated())
          break
        case 'EQUITY':
          equity = equity.plus(net.negated())
          break
        case 'REVENUE':
          income = income.plus(net.negated())
          break
        case 'EXPENSE':
        case 'COGS':
          expense = expense.plus(net)
          break
        default:
          break
      }
    }

    const netIncome = income.minus(expense)
    rows.push({
      fundId: fund.id,
      fundName: fund.name,
      assets: assets.toFixed(2),
      liabilities: liabilities.toFixed(2),
      equity: equity.toFixed(2),
      income: income.toFixed(2),
      expense: expense.toFixed(2),
      netIncome: netIncome.toFixed(2),
      equityPlusNet: equity.plus(netIncome).toFixed(2),
    })
  }

  return rows
}

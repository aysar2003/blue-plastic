import 'server-only'

import { overdueAgingTotals } from '@/lib/erp/loan-aging'
import { collectionCredits, shouldAccrueInterest } from '@/lib/erp/loan-interest'
import { generateLoanSchedule } from '@/lib/erp/loan-schedule'
import { toCalendarDate, toDate, today } from '@/lib/date'
import { Decimal } from '@/lib/money'
import { seedChartOfAccounts, systemAccountId } from '@/server/accounting/chart-of-accounts'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import * as journalService from '@/server/services/journal.service'

export async function listProducts(ctx: OrgContext) {
  assertPermission(ctx, 'customer:read')
  return db.loanProduct.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { name: 'asc' },
  })
}

export async function createProduct(
  ctx: OrgContext,
  input: { name: string; defaultRate: string; defaultTermMonths: number },
) {
  assertPermission(ctx, 'customer:create')
  return db.loanProduct.create({
    data: {
      orgId: ctx.orgId,
      name: input.name.trim(),
      defaultRate: new Decimal(input.defaultRate).toFixed(6),
      defaultTermMonths: input.defaultTermMonths,
    },
  })
}

export async function listAccounts(ctx: OrgContext) {
  assertPermission(ctx, 'customer:read')
  return db.loanAccount.findMany({
    where: { orgId: ctx.orgId },
    include: {
      customer: { select: { id: true, displayName: true } },
      product: { select: { id: true, name: true } },
      schedule: { orderBy: { dueDate: 'asc' }, take: 120 },
    },
    orderBy: { startDate: 'desc' },
    take: 80,
  })
}

export async function createAccount(
  ctx: OrgContext,
  input: {
    customerId: string
    productId?: string | null
    principal: string
    annualRate: string
    termMonths: number
    startDate: string
  },
) {
  assertPermission(ctx, 'journal:post')
  const principal = new Decimal(input.principal)
  if (principal.lessThanOrEqualTo(0)) throw validation('Principal must be positive.')

  const account = await db.loanAccount.create({
    data: {
      orgId: ctx.orgId,
      customerId: input.customerId,
      productId: input.productId || null,
      principal: principal.toFixed(4),
      annualRate: new Decimal(input.annualRate).toFixed(6),
      termMonths: input.termMonths,
      startDate: toDate(input.startDate),
    },
  })

  const lines = generateLoanSchedule(
    principal,
    input.annualRate,
    input.termMonths,
    input.startDate.slice(0, 10) as import('@/lib/date').CalendarDate,
  )
  await db.loanScheduleLine.createMany({
    data: lines.map((line) => ({
      orgId: ctx.orgId,
      loanAccountId: account.id,
      dueDate: toDate(line.dueDate),
      principalDue: line.principalDue,
      interestDue: line.interestDue,
    })),
  })

  return account
}

export async function disburse(
  ctx: OrgContext,
  input: { loanAccountId: string; bankAccountId: string; date?: string },
) {
  assertPermission(ctx, 'journal:post')
  const account = await db.loanAccount.findFirst({
    where: { id: input.loanAccountId, orgId: ctx.orgId },
    include: { customer: { select: { displayName: true } } },
  })
  if (!account) throw notFound('Loan account')
  if (account.disbursementJournalId) {
    throw precondition('This loan has already been disbursed.')
  }
  const bank = await db.ledgerAccount.findFirst({
    where: {
      id: input.bankAccountId,
      orgId: ctx.orgId,
      isActive: true,
      subtype: { in: ['BANK', 'UNDEPOSITED_FUNDS'] },
    },
    select: { id: true, name: true },
  })
  if (!bank) throw validation('Choose an active bank account to disburse from.')

  const date = (input.date || toCalendarDate(account.startDate)) as import('@/lib/date').CalendarDate
  const principal = new Decimal(account.principal.toString())
  const { loanReceivableId } = await db.$transaction(async (tx) => {
    await seedChartOfAccounts(tx, ctx.orgId)
    return { loanReceivableId: await systemAccountId(tx, ctx.orgId, 'LOAN_RECEIVABLE') }
  })

  const journal = await journalService.createManual(ctx, {
    number: undefined,
    date,
    memo: `Loan disbursement · ${account.customer.displayName}`,
    isAdjusting: false,
    autoReverse: false,
    lines: [
      {
        accountId: loanReceivableId,
        debit: principal.toFixed(4),
        credit: '0',
        description: 'Loan principal advanced',
      },
      {
        accountId: bank.id,
        debit: '0',
        credit: principal.toFixed(4),
        description: `Disbursed from ${bank.name}`,
      },
    ],
  })

  await db.loanAccount.update({
    where: { id: account.id },
    data: {
      bankAccountId: bank.id,
      disbursementJournalId: journal.id,
      disbursedAt: new Date(),
    },
  })
  return { loanAccountId: account.id, journalId: journal.id }
}

export async function overdueAging(ctx: OrgContext, asOf?: string) {
  assertPermission(ctx, 'customer:read')
  const asOfDate = asOf ?? today(ctx.organization.timeZone)
  const accounts = await db.loanAccount.findMany({
    where: { orgId: ctx.orgId, status: 'ACTIVE' },
    include: {
      customer: { select: { displayName: true } },
      schedule: { orderBy: { dueDate: 'asc' } },
    },
    take: 80,
  })
  return accounts.map((account) => {
    const lines = account.schedule.map((line) => ({
      dueDate: toCalendarDate(line.dueDate),
      paidAt: line.paidAt,
      principalDue: line.principalDue.toString(),
      interestDue: line.interestDue.toString(),
    }))
    const totals = overdueAgingTotals(lines, asOfDate)
    return {
      id: account.id,
      customerName: account.customer.displayName,
      principal: account.principal.toString(),
      disbursed: Boolean(account.disbursementJournalId),
      ...totals,
    }
  })
}

export async function accrueInterest(ctx: OrgContext, asOf?: string) {
  assertPermission(ctx, 'journal:post')
  const asOfDate = asOf ? toDate(asOf) : toDate(today(ctx.organization.timeZone))
  const dueLines = await db.loanScheduleLine.findMany({
    where: {
      orgId: ctx.orgId,
      paidAt: null,
      dueDate: { lte: asOfDate },
      interestJournalId: null,
      loanAccount: { status: 'ACTIVE', disbursementJournalId: { not: null } },
    },
    include: { loanAccount: { select: { customer: { select: { displayName: true } } } } },
    orderBy: { dueDate: 'asc' },
    take: 80,
  })

  const { loanReceivableId, interestIncomeId } = await db.$transaction(async (tx) => {
    await seedChartOfAccounts(tx, ctx.orgId)
    return {
      loanReceivableId: await systemAccountId(tx, ctx.orgId, 'LOAN_RECEIVABLE'),
      interestIncomeId: await systemAccountId(tx, ctx.orgId, 'LOAN_INTEREST_INCOME'),
    }
  })

  const posted: { lineId: string; journalId: string }[] = []
  for (const line of dueLines) {
    if (
      !shouldAccrueInterest({
        paidAt: line.paidAt,
        interestJournalId: line.interestJournalId,
        interestDue: line.interestDue.toString(),
      })
    ) {
      continue
    }
    const interest = new Decimal(line.interestDue.toString())
    const journal = await journalService.createManual(ctx, {
      number: undefined,
      date: line.dueDate.toISOString().slice(0, 10) as import('@/lib/date').CalendarDate,
      memo: `Loan interest accrual · ${line.loanAccount.customer.displayName}`,
      isAdjusting: true,
      autoReverse: false,
      lines: [
        {
          accountId: loanReceivableId,
          debit: interest.toFixed(4),
          credit: '0',
          description: 'Accrued loan interest',
        },
        {
          accountId: interestIncomeId,
          debit: '0',
          credit: interest.toFixed(4),
          description: 'Loan interest income',
        },
      ],
    })
    await db.loanScheduleLine.update({
      where: { id: line.id },
      data: { interestJournalId: journal.id },
    })
    posted.push({ lineId: line.id, journalId: journal.id })
  }

  return { asOf: asOfDate.toISOString().slice(0, 10), postedCount: posted.length, posted }
}

export async function postDue(ctx: OrgContext, asOf?: string) {
  assertPermission(ctx, 'journal:post')
  const asOfDate = asOf ? toDate(asOf) : toDate(today(ctx.organization.timeZone))

  const dueLines = await db.loanScheduleLine.findMany({
    where: {
      orgId: ctx.orgId,
      paidAt: null,
      dueDate: { lte: asOfDate },
      loanAccount: { status: 'ACTIVE' },
    },
    include: { loanAccount: { select: { id: true, customer: { select: { displayName: true } } } } },
    orderBy: { dueDate: 'asc' },
    take: 40,
  })

  const { undepositedId, loanReceivableId, interestIncomeId } = await db.$transaction(async (tx) => {
    await seedChartOfAccounts(tx, ctx.orgId)
    return {
      undepositedId: await systemAccountId(tx, ctx.orgId, 'UNDEPOSITED_FUNDS'),
      loanReceivableId: await systemAccountId(tx, ctx.orgId, 'LOAN_RECEIVABLE'),
      interestIncomeId: await systemAccountId(tx, ctx.orgId, 'LOAN_INTEREST_INCOME'),
    }
  })

  const posted: { lineId: string; journalIds: string[] }[] = []
  for (const line of dueLines) {
    const credits = collectionCredits({
      principalDue: line.principalDue.toString(),
      interestDue: line.interestDue.toString(),
      interestAccrued: Boolean(line.interestJournalId),
    })
    const memo = `Loan collection ${line.dueDate.toISOString().slice(0, 10)} · ${line.loanAccount.customer.displayName} · principal ${credits.principal.toFixed(2)}`

    const journalLines: {
      accountId: string
      debit: string
      credit: string
      description: string
    }[] = [
      {
        accountId: undepositedId,
        debit: credits.cash.toFixed(4),
        credit: '0',
        description: 'Loan installment received',
      },
      {
        accountId: loanReceivableId,
        debit: '0',
        credit: credits.principal.plus(credits.accruedReceivable).toFixed(4),
        description: credits.accruedReceivable.greaterThan(0)
          ? 'Loan principal + accrued interest collected'
          : 'Loan principal collected',
      },
    ]
    if (credits.interestIncome.greaterThan(0)) {
      journalLines.push({
        accountId: interestIncomeId,
        debit: '0',
        credit: credits.interestIncome.toFixed(4),
        description: 'Loan interest income',
      })
    }

    const journal = await journalService.createManual(ctx, {
      number: undefined,
      date: line.dueDate.toISOString().slice(0, 10) as import('@/lib/date').CalendarDate,
      memo,
      isAdjusting: false,
      autoReverse: false,
      lines: journalLines,
    })

    await db.loanScheduleLine.update({
      where: { id: line.id },
      data: {
        paidAt: new Date(),
        principalJournalId: journal.id,
        interestJournalId: line.interestJournalId ?? journal.id,
      },
    })
    posted.push({ lineId: line.id, journalIds: [journal.id] })
  }

  return { asOf: asOfDate.toISOString().slice(0, 10), postedCount: posted.length, posted }
}

export async function getAccount(ctx: OrgContext, id: string) {
  const row = await db.loanAccount.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      customer: true,
      schedule: { orderBy: { dueDate: 'asc' } },
    },
  })
  if (!row) throw notFound('Loan account')
  return row
}
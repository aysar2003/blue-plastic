import 'server-only'

import { jobCostOverBudget } from '@/lib/erp/verticals-p5'
import { Decimal } from '@/lib/money'
import { today } from '@/lib/date'
import {
  canBillMilestone,
  milestoneAmount,
  type SalesContractStatus,
} from '@/lib/erp/contracts'
import {
  clampPercent,
  progressBillGross,
  retentionHeld,
} from '@/lib/erp/verticals-p5'
import { seedChartOfAccounts, systemAccountId } from '@/server/accounting/chart-of-accounts'
import { postJournal } from '@/server/accounting/posting'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'
import { assignDocumentNumber, numberTaken } from '@/server/sequences'
import * as salesService from '@/server/services/sales.service'

export async function updateProjectContract(
  ctx: OrgContext,
  input: {
    projectId: string
    contractValue?: string | null
    retentionPercent?: string | null
    retainerAmount?: string | null
    budgetAmount?: string | null
  },
) {
  const project = await db.project.findFirst({
    where: { id: input.projectId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!project) throw notFound('Project')

  return db.project.update({
    where: { id: project.id },
    data: {
      contractValue:
        input.contractValue != null && input.contractValue !== ''
          ? new Decimal(input.contractValue)
          : null,
      retentionPercent:
        input.retentionPercent != null && input.retentionPercent !== ''
          ? clampPercent(input.retentionPercent)
          : null,
      retainerAmount:
        input.retainerAmount != null && input.retainerAmount !== ''
          ? new Decimal(input.retainerAmount)
          : null,
      budgetAmount:
        input.budgetAmount != null && input.budgetAmount !== ''
          ? new Decimal(input.budgetAmount)
          : null,
    },
  })
}

/** Raise a progress invoice for the delta % on the project contract. */
export async function billProgress(
  ctx: OrgContext,
  input: { projectId: string; toPercent: string; itemId: string; description?: string },
) {
  const project = await db.project.findFirst({
    where: { id: input.projectId, orgId: ctx.orgId },
    select: {
      id: true,
      name: true,
      number: true,
      customerId: true,
      contractValue: true,
      retentionPercent: true,
      billedPercent: true,
    },
  })
  if (!project) throw notFound('Project')
  if (!project.contractValue) throw validation('Set a contract value on the project first.')

  const item = await db.item.findFirst({
    where: { id: input.itemId, orgId: ctx.orgId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  })
  if (!item) throw notFound('Progress item')

  const bill = progressBillGross({
    contractValue: project.contractValue.toString(),
    alreadyBilledPercent: project.billedPercent.toString(),
    thisBillPercent: input.toPercent,
  })
  if (!bill.ok) throw validation(bill.message)

  const retentionPct = project.retentionPercent?.toString() ?? '0'
  const held = retentionHeld(bill.gross, retentionPct)
  const net = new Decimal(bill.gross).minus(held)

  const invoice = await salesService.create(ctx, 'INVOICE', {
    number: undefined,
    customerId: project.customerId,
    date: today(ctx.organization.timeZone),
    projectId: project.id,
    lines: [
      {
        itemId: item.id,
        quantity: '1',
        unitPrice: net.toFixed(4),
        description:
          input.description?.trim() ||
          `${project.number} progress to ${clampPercent(input.toPercent)}%` +
            (Number(held) > 0 ? ` (retention ${held} held)` : ''),
      },
    ],
    saveAsDraft: false,
    acknowledgeCreditLimit: false,
    discountKind: 'percent',
    retentionAmount: held,
    progressPercent: String(clampPercent(input.toPercent)),
    customerMessage: `Progress bill · ${project.name}`,
  })

  const advanced = await db.project.updateMany({
    where: {
      id: project.id,
      billedPercent: project.billedPercent,
    },
    data: { billedPercent: clampPercent(input.toPercent) },
  })
  if (advanced.count === 0) {
    await salesService.remove(ctx, invoice.id, 'Progress already billed by another request')
    throw conflict('Another progress bill already updated this project. Try again.')
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    gross: bill.gross,
    retention: held,
    net: net.toFixed(4),
  }
}

/**
 * Release retention held on a progress invoice into AR:
 *   Dr Accounts Receivable   held
 *     Cr Retention receivable  held
 */
export async function releaseRetention(ctx: OrgContext, invoiceId: string) {
  return db.$transaction(async (tx) => {
    const document = await tx.salesDocument.findFirst({
      where: {
        id: invoiceId,
        orgId: ctx.orgId,
        type: 'INVOICE',
        deletedAt: null,
      },
      select: {
        id: true,
        number: true,
        customerId: true,
        date: true,
        retentionAmount: true,
        retentionReleasedAt: true,
        status: true,
      },
    })
    if (!document) throw notFound('Invoice')
    if (document.status === 'VOID') {
      throw precondition('A void invoice cannot release retention.')
    }
    if (document.retentionReleasedAt) {
      throw conflict('Retention on this invoice was already released.')
    }
    const held = new Decimal(document.retentionAmount?.toString() ?? '0')
    if (held.lessThanOrEqualTo(0)) {
      throw validation('This invoice has no retention to release.')
    }

    await seedChartOfAccounts(tx, ctx.orgId)
    const arId = await systemAccountId(tx, ctx.orgId, 'ACCOUNTS_RECEIVABLE')
    const retentionId = await systemAccountId(tx, ctx.orgId, 'RETENTION_RECEIVABLE')

    const journal = await postJournal(tx, ctx, {
      date: today(ctx.organization.timeZone),
      memo: `Retention release · ${document.number}`,
      sourceType: 'MANUAL',
      sourceId: document.id,
      idempotencyKey: `retention-release:${document.id}`,
      lines: [
        {
          accountId: arId,
          debit: held,
          customerId: document.customerId,
          description: `Retention due · ${document.number}`,
        },
        {
          accountId: retentionId,
          credit: held,
          customerId: document.customerId,
          description: `Retention release · ${document.number}`,
        },
      ],
    })

    await tx.salesDocument.update({
      where: { id: document.id },
      data: { retentionReleasedAt: new Date() },
    })

    return {
      invoiceId: document.id,
      invoiceNumber: document.number,
      journalId: journal.id,
      amount: held.toFixed(4),
    }
  })
}

export async function jobCostReport(ctx: OrgContext, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, orgId: ctx.orgId },
    select: {
      id: true,
      name: true,
      number: true,
      contractValue: true,
      budgetAmount: true,
      billedPercent: true,
      retentionPercent: true,
    },
  })
  if (!project) throw notFound('Project')

  const [sales, purchases, committedAgg] = await Promise.all([
    db.salesDocument.aggregate({
      where: {
        orgId: ctx.orgId,
        projectId,
        deletedAt: null,
        status: { not: 'VOID' },
        type: { in: ['INVOICE', 'SALES_RECEIPT'] },
      },
      _sum: { total: true },
    }),
    db.purchaseDocument.aggregate({
      where: {
        orgId: ctx.orgId,
        projectId,
        deletedAt: null,
        status: { not: 'VOID' },
        type: { in: ['BILL', 'EXPENSE'] },
      },
      _sum: { total: true },
    }),
    db.purchaseDocument.aggregate({
      where: {
        orgId: ctx.orgId,
        projectId,
        deletedAt: null,
        type: 'PURCHASE_ORDER',
        encumbered: true,
        status: { in: ['OPEN', 'PARTIAL', 'PENDING_APPROVAL'] },
      },
      _sum: { total: true },
    }),
  ])

  const billed = new Decimal(sales._sum.total?.toString() ?? '0')
  const costs = new Decimal(purchases._sum.total?.toString() ?? '0')
  const committed = new Decimal(committedAgg._sum.total?.toString() ?? '0')
  const contract = new Decimal(project.contractValue?.toString() ?? '0')
  const budget = project.budgetAmount
    ? new Decimal(project.budgetAmount.toString())
    : null

  const budgetStr = budget?.toFixed(2) ?? null
  const costsStr = costs.toFixed(2)
  const committedStr = committed.toFixed(2)
  return {
    project,
    billed: billed.toFixed(2),
    costs: costsStr,
    committed: committedStr,
    margin: billed.minus(costs).toFixed(2),
    contractRemaining: contract.minus(billed).toFixed(2),
    budget: budgetStr,
    budgetVariance: budget ? budget.minus(costs.plus(committed)).toFixed(2) : null,
    overBudget: jobCostOverBudget({ costs: costsStr, committed: committedStr, budget: budgetStr }),
  }
}

/** Job cost vs contract for open projects (progress hub). */
export async function listJobCostSummaries(ctx: OrgContext) {
  const projects = await db.project.findMany({
    where: { orgId: ctx.orgId, status: { in: ['DRAFT', 'ACTIVE', 'ON_HOLD'] } },
    select: {
      id: true,
      name: true,
      number: true,
      contractValue: true,
      budgetAmount: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
  if (projects.length === 0) return []

  const projectIds = projects.map((row) => row.id)
  const [sales, purchases, committed] = await Promise.all([
    db.salesDocument.groupBy({
      by: ['projectId'],
      where: {
        orgId: ctx.orgId,
        projectId: { in: projectIds },
        deletedAt: null,
        status: { not: 'VOID' },
        type: { in: ['INVOICE', 'SALES_RECEIPT'] },
      },
      _sum: { total: true },
    }),
    db.purchaseDocument.groupBy({
      by: ['projectId'],
      where: {
        orgId: ctx.orgId,
        projectId: { in: projectIds },
        deletedAt: null,
        status: { not: 'VOID' },
        type: { in: ['BILL', 'EXPENSE'] },
      },
      _sum: { total: true },
    }),
    db.purchaseDocument.groupBy({
      by: ['projectId'],
      where: {
        orgId: ctx.orgId,
        projectId: { in: projectIds },
        deletedAt: null,
        type: 'PURCHASE_ORDER',
        encumbered: true,
        status: { in: ['OPEN', 'PARTIAL', 'PENDING_APPROVAL'] },
      },
      _sum: { total: true },
    }),
  ])

  const billedBy = new Map(
    sales.map((row) => [row.projectId, new Decimal(row._sum.total?.toString() ?? '0')]),
  )
  const costBy = new Map(
    purchases.map((row) => [row.projectId, new Decimal(row._sum.total?.toString() ?? '0')]),
  )
  const committedBy = new Map(
    committed.map((row) => [row.projectId, new Decimal(row._sum.total?.toString() ?? '0')]),
  )

  return projects.map((project) => {
    const billed = billedBy.get(project.id) ?? new Decimal(0)
    const costs = costBy.get(project.id) ?? new Decimal(0)
    const committed = committedBy.get(project.id) ?? new Decimal(0)
    const contract = new Decimal(project.contractValue?.toString() ?? '0')
    const budget = project.budgetAmount
      ? new Decimal(project.budgetAmount.toString())
      : null
    const budgetStr = budget?.toFixed(2) ?? null
    const costsStr = costs.toFixed(2)
    const committedStr = committed.toFixed(2)
    return {
      projectId: project.id,
      number: project.number,
      name: project.name,
      contract: contract.toFixed(2),
      budget: budgetStr,
      budgetVariance: budget ? budget.minus(costs.plus(committed)).toFixed(2) : null,
      overBudget: jobCostOverBudget({ costs: costsStr, committed: committedStr, budget: budgetStr }),
      billed: billed.toFixed(2),
      costs: costsStr,
      committed: committedStr,
      margin: billed.minus(costs).toFixed(2),
      remaining: contract.minus(billed).toFixed(2),
    }
  })
}

export async function listContracts(ctx: OrgContext) {
  return db.salesContract.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    include: {
      customer: { select: { displayName: true } },
      project: { select: { number: true, name: true } },
      milestones: { orderBy: { lineNumber: 'asc' }, select: { id: true, name: true, percent: true, billedAt: true } },
    },
    take: 100,
  }).then((rows) =>
    rows.map((row) => ({
      ...row,
      contractValue: row.contractValue.toString(),
      milestones: row.milestones.map((m) => ({
        ...m,
        percent: m.percent.toString(),
      })),
    })),
  )
}

export async function getContract(ctx: OrgContext, id: string) {
  const row = await db.salesContract.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      customer: { select: { id: true, displayName: true } },
      project: { select: { id: true, number: true, name: true } },
      milestones: {
        orderBy: { lineNumber: 'asc' },
        include: { salesDocument: { select: { id: true, number: true } } },
      },
    },
  })
  if (!row) throw notFound('Contract')
  return {
    ...row,
    contractValue: row.contractValue.toString(),
    milestones: row.milestones.map((m) => ({
      ...m,
      percent: m.percent.toString(),
    })),
  }
}

export async function activateContract(ctx: OrgContext, contractId: string) {
  const row = await db.salesContract.findFirst({
    where: { id: contractId, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Contract')
  if (row.status !== 'DRAFT') throw precondition('Only draft contracts can be activated.')
  await db.salesContract.update({
    where: { id: row.id },
    data: { status: 'ACTIVE' },
  })
  return { id: row.id }
}

/** Bill one contract milestone into a posted customer invoice. */
export async function billMilestone(
  ctx: OrgContext,
  input: { contractId: string; milestoneId: string; itemId: string; description?: string },
) {
  const contract = await db.salesContract.findFirst({
    where: { id: input.contractId, orgId: ctx.orgId },
    include: {
      customer: { select: { id: true } },
      project: { select: { id: true } },
      milestones: { where: { id: input.milestoneId } },
    },
  })
  if (!contract) throw notFound('Contract')
  const milestone = contract.milestones[0]
  if (!milestone) throw notFound('Milestone')

  const gate = canBillMilestone({
    contractStatus: contract.status as SalesContractStatus,
    milestoneBilledAt: milestone.billedAt,
    milestonePercent: milestone.percent.toString(),
  })
  if (!gate.ok) throw validation(gate.message)

  if (!contract.customerId) {
    throw validation('Set a customer on the contract before billing.')
  }

  const item = await db.item.findFirst({
    where: { id: input.itemId, orgId: ctx.orgId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  })
  if (!item) throw notFound('Item')

  const net = milestoneAmount(contract.contractValue.toString(), milestone.percent.toString())

  const invoice = await salesService.create(ctx, 'INVOICE', {
    number: undefined,
    customerId: contract.customerId,
    date: today(ctx.organization.timeZone),
    projectId: contract.projectId ?? undefined,
    lines: [
      {
        itemId: item.id,
        quantity: '1',
        unitPrice: net,
        description:
          input.description?.trim() ||
          `${contract.number} · ${milestone.name} (${milestone.percent.toString()}%)`,
      },
    ],
    saveAsDraft: false,
    acknowledgeCreditLimit: false,
    discountKind: 'percent',
    customerMessage: contract.name,
  })

  await db.contractMilestone.update({
    where: { id: milestone.id },
    data: {
      billedAt: new Date(),
      salesDocumentId: invoice.id,
    },
  })

  return {
    contractId: contract.id,
    milestoneId: milestone.id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    amount: net,
  }
}

/**
 * Release vendor retention on a bill (Phase 38 lite):
 *   Dr Retention payable
 *     Cr Accounts payable
 *
 * Bill posting does not auto-split retention; `retentionAmount` is stored on the bill.
 */
export async function releaseVendorRetention(ctx: OrgContext, billId: string) {
  return db.$transaction(async (tx) => {
    const document = await tx.purchaseDocument.findFirst({
      where: {
        id: billId,
        orgId: ctx.orgId,
        type: 'BILL',
        deletedAt: null,
      },
      select: {
        id: true,
        number: true,
        vendorId: true,
        date: true,
        retentionAmount: true,
        retentionReleasedAt: true,
        status: true,
      },
    })
    if (!document) throw notFound('Bill')
    if (document.status === 'VOID') {
      throw precondition('A void bill cannot release retention.')
    }
    if (document.retentionReleasedAt) {
      throw conflict('Retention on this bill was already released.')
    }
    const held = new Decimal(document.retentionAmount?.toString() ?? '0')
    if (held.lessThanOrEqualTo(0)) {
      throw validation('This bill has no retention to release.')
    }
    if (!document.vendorId) throw validation('Bill has no vendor.')

    await seedChartOfAccounts(tx, ctx.orgId)
    const apId = await systemAccountId(tx, ctx.orgId, 'ACCOUNTS_PAYABLE')
    const retentionId = await systemAccountId(tx, ctx.orgId, 'RETENTION_PAYABLE')

    const journal = await postJournal(tx, ctx, {
      date: today(ctx.organization.timeZone),
      memo: `Vendor retention release · ${document.number}`,
      sourceType: 'MANUAL',
      sourceId: document.id,
      idempotencyKey: `vendor-retention-release:${document.id}`,
      lines: [
        {
          accountId: retentionId,
          debit: held,
          vendorId: document.vendorId,
          description: `Retention release · ${document.number}`,
        },
        {
          accountId: apId,
          credit: held,
          vendorId: document.vendorId,
          description: `Retention due · ${document.number}`,
        },
      ],
    })

    await tx.purchaseDocument.update({
      where: { id: document.id },
      data: { retentionReleasedAt: new Date() },
    })

    return {
      billId: document.id,
      billNumber: document.number,
      journalId: journal.id,
      amount: held.toFixed(4),
    }
  })
}

export async function createContract(
  ctx: OrgContext,
  input: {
    number?: string
    name: string
    contractValue: string
    customerId?: string | null
    projectId?: string | null
    memo?: string | null
    milestones: { name: string; percent: string }[]
  },
) {
  return db.$transaction(async (tx) => {
    const number = await assignDocumentNumber(tx, ctx.orgId, 'SALES_CONTRACT', input.number)
    const clash = await tx.salesContract.findFirst({
      where: { orgId: ctx.orgId, number },
      select: { id: true },
    })
    if (clash) throw numberTaken()

    if (input.customerId) {
      const customer = await tx.customer.findFirst({
        where: { id: input.customerId, orgId: ctx.orgId },
        select: { id: true },
      })
      if (!customer) throw notFound('Customer')
    }
    if (input.projectId) {
      const project = await tx.project.findFirst({
        where: { id: input.projectId, orgId: ctx.orgId },
        select: { id: true },
      })
      if (!project) throw notFound('Project')
    }

    let lineNumber = 0
    const contract = await tx.salesContract.create({
      data: {
        orgId: ctx.orgId,
        number,
        name: input.name.trim(),
        contractValue: input.contractValue,
        customerId: input.customerId ?? null,
        projectId: input.projectId ?? null,
        memo: input.memo?.trim() || null,
        status: 'DRAFT',
        milestones: {
          create: input.milestones.map((m) => ({
            orgId: ctx.orgId,
            lineNumber: ++lineNumber,
            name: m.name.trim(),
            percent: m.percent,
          })),
        },
      },
      select: { id: true, number: true },
    })
    return contract
  })
}

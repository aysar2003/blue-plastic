import 'server-only'

import { Decimal } from '@/lib/money'
import { today } from '@/lib/date'
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
import * as salesService from '@/server/services/sales.service'

export async function updateProjectContract(
  ctx: OrgContext,
  input: {
    projectId: string
    contractValue?: string | null
    retentionPercent?: string | null
    retainerAmount?: string | null
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
      billedPercent: true,
      retentionPercent: true,
    },
  })
  if (!project) throw notFound('Project')

  const [sales, purchases] = await Promise.all([
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
  ])

  const billed = new Decimal(sales._sum.total?.toString() ?? '0')
  const costs = new Decimal(purchases._sum.total?.toString() ?? '0')
  const contract = new Decimal(project.contractValue?.toString() ?? '0')

  return {
    project,
    billed: billed.toFixed(2),
    costs: costs.toFixed(2),
    margin: billed.minus(costs).toFixed(2),
    contractRemaining: contract.minus(billed).toFixed(2),
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
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
  if (projects.length === 0) return []

  const projectIds = projects.map((row) => row.id)
  const [sales, purchases] = await Promise.all([
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
  ])

  const billedBy = new Map(
    sales.map((row) => [row.projectId, new Decimal(row._sum.total?.toString() ?? '0')]),
  )
  const costBy = new Map(
    purchases.map((row) => [row.projectId, new Decimal(row._sum.total?.toString() ?? '0')]),
  )

  return projects.map((project) => {
    const billed = billedBy.get(project.id) ?? new Decimal(0)
    const costs = costBy.get(project.id) ?? new Decimal(0)
    const contract = new Decimal(project.contractValue?.toString() ?? '0')
    return {
      projectId: project.id,
      number: project.number,
      name: project.name,
      contract: contract.toFixed(2),
      billed: billed.toFixed(2),
      costs: costs.toFixed(2),
      margin: billed.minus(costs).toFixed(2),
      remaining: contract.minus(billed).toFixed(2),
    }
  })
}

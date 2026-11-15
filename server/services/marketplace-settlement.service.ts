import 'server-only'

import { settlementTotals } from '@/lib/erp/marketplace-settlement'
import { Decimal } from '@/lib/money'
import { toCalendarDate, toDate } from '@/lib/date'
import { seedChartOfAccounts, systemAccountId } from '@/server/accounting/chart-of-accounts'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition } from '@/server/errors'
import * as journalService from '@/server/services/journal.service'

export async function listSellers(ctx: OrgContext) {
  assertPermission(ctx, 'vendor:read')
  return db.marketplaceSeller.findMany({
    where: { orgId: ctx.orgId },
    include: { vendor: { select: { id: true, displayName: true } } },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function upsertSeller(
  ctx: OrgContext,
  input: { vendorId: string; commissionPercent: string },
) {
  assertPermission(ctx, 'vendor:update')
  const pct = new Decimal(input.commissionPercent || 0).toDecimalPlaces(4)
  return db.marketplaceSeller.upsert({
    where: { orgId_vendorId: { orgId: ctx.orgId, vendorId: input.vendorId } },
    create: { orgId: ctx.orgId, vendorId: input.vendorId, commissionPercent: pct },
    update: { commissionPercent: pct, isActive: true },
  })
}

export async function listBatches(ctx: OrgContext) {
  assertPermission(ctx, 'invoice:read')
  return db.settlementBatch.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { periodEnd: 'desc' },
    take: 40,
  })
}

export async function settlePeriod(
  ctx: OrgContext,
  input: { periodStart: string; periodEnd: string },
) {
  assertPermission(ctx, 'journal:post')
  const periodStart = toDate(input.periodStart)
  const periodEnd = toDate(input.periodEnd)

  const sellers = await db.marketplaceSeller.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { vendorId: true, commissionPercent: true },
  })
  const commissionByVendor = new Map(
    sellers.map((row) => [row.vendorId, new Decimal(row.commissionPercent.toString())]),
  )

  const lines = await db.salesDocumentLine.findMany({
    where: {
      orgId: ctx.orgId,
      sellerVendorId: { not: null },
      document: {
        type: 'INVOICE',
        deletedAt: null,
        date: { gte: periodStart, lte: periodEnd },
      },
    },
    select: { sellerVendorId: true, amount: true },
    take: 5000,
  })

  const saleRows = lines
    .filter((row) => row.sellerVendorId && commissionByVendor.has(row.sellerVendorId))
    .map((row) => ({
      vendorId: row.sellerVendorId!,
      lineAmount: row.amount.toString(),
      commissionPercent: commissionByVendor.get(row.sellerVendorId!)!.toString(),
    }))

  const totals = settlementTotals(saleRows)
  const batch = await db.settlementBatch.create({
    data: {
      orgId: ctx.orgId,
      periodStart,
      periodEnd,
      grossSales: totals.grossSales,
      commission: totals.commission,
      sellerPayable: totals.sellerPayable,
      status: 'DRAFT',
      memo: `Marketplace settlement ${input.periodStart}–${input.periodEnd}`,
    },
  })

  if (new Decimal(totals.grossSales).isZero()) {
    return { batchId: batch.id, ...totals, journalId: null as string | null }
  }

  const { clearingId, commissionIncomeId, commissionPayableId } = await db.$transaction(async (tx) => {
    await seedChartOfAccounts(tx, ctx.orgId)
    return {
      clearingId: await systemAccountId(tx, ctx.orgId, 'UNDEPOSITED_FUNDS'),
      commissionIncomeId: await systemAccountId(tx, ctx.orgId, 'COMMISSION_INCOME'),
      commissionPayableId: await systemAccountId(tx, ctx.orgId, 'COMMISSION_PAYABLE'),
    }
  })

  const journal = await journalService.createManual(ctx, {
    number: undefined,
    date: input.periodEnd.slice(0, 10) as import('@/lib/date').CalendarDate,
    memo: batch.memo ?? 'Marketplace settlement',
    isAdjusting: false,
    autoReverse: false,
    lines: [
      {
        accountId: clearingId,
        debit: totals.grossSales,
        credit: '0',
        description: 'Gross marketplace receipts',
      },
      {
        accountId: commissionIncomeId,
        debit: '0',
        credit: totals.commission,
        description: 'Platform commission income',
      },
      {
        accountId: commissionPayableId,
        debit: '0',
        credit: totals.sellerPayable,
        description: 'Seller share payable',
      },
    ],
  })

  await db.settlementBatch.update({
    where: { id: batch.id },
    data: { status: 'POSTED', journalId: journal.id },
  })

  return { batchId: batch.id, ...totals, journalId: journal.id }
}

export async function getBatch(ctx: OrgContext, id: string) {
  const row = await db.settlementBatch.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!row) throw notFound('Settlement batch')
  return row
}

export async function postBatch(ctx: OrgContext, id: string) {
  const row = await getBatch(ctx, id)
  if (row.status === 'POSTED') throw precondition('Batch already posted.')
  return settlePeriod(ctx, {
    periodStart: row.periodStart.toISOString().slice(0, 10),
    periodEnd: row.periodEnd.toISOString().slice(0, 10),
  })
}
import 'server-only'

import { sellerStatements, settlementTotals, type SellerSaleRow } from '@/lib/erp/marketplace-settlement'
import { Decimal } from '@/lib/money'
import { toDate, type CalendarDate } from '@/lib/date'
import { seedChartOfAccounts, systemAccountId } from '@/server/accounting/chart-of-accounts'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition } from '@/server/errors'
import * as billPaymentService from '@/server/services/bill-payment.service'
import * as journalService from '@/server/services/journal.service'
import * as purchaseService from '@/server/services/purchase.service'

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
    include: {
      sellerLines: {
        include: {
          vendor: { select: { id: true, displayName: true } },
          purchaseDocument: { select: { id: true, number: true } },
          billPayment: { select: { id: true, number: true } },
        },
      },
    },
    orderBy: { periodEnd: 'desc' },
    take: 40,
  })
}

async function sellerSaleRows(
  ctx: OrgContext,
  periodStart: Date,
  periodEnd: Date,
): Promise<SellerSaleRow[]> {
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

  return lines
    .filter((row) => row.sellerVendorId && commissionByVendor.has(row.sellerVendorId))
    .map((row) => ({
      vendorId: row.sellerVendorId!,
      lineAmount: row.amount.toString(),
      commissionPercent: commissionByVendor.get(row.sellerVendorId!)!.toString(),
    }))
}

export async function listSellerStatements(
  ctx: OrgContext,
  input: { periodStart: string; periodEnd: string },
) {
  assertPermission(ctx, 'invoice:read')
  const saleRows = await sellerSaleRows(ctx, toDate(input.periodStart), toDate(input.periodEnd))
  const statements = sellerStatements(saleRows)
  const vendors = await db.vendor.findMany({
    where: { orgId: ctx.orgId, id: { in: statements.map((row) => row.vendorId) } },
    select: { id: true, displayName: true },
  })
  const nameById = new Map(vendors.map((row) => [row.id, row.displayName]))
  return statements.map((row) => ({
    ...row,
    vendorName: nameById.get(row.vendorId) ?? row.vendorId,
  }))
}

export async function settlePeriod(
  ctx: OrgContext,
  input: { periodStart: string; periodEnd: string; paymentAccountId?: string | null },
) {
  assertPermission(ctx, 'journal:post')
  const periodStart = toDate(input.periodStart)
  const periodEnd = toDate(input.periodEnd)
  const settleDate = input.periodEnd.slice(0, 10) as CalendarDate

  const saleRows = await sellerSaleRows(ctx, periodStart, periodEnd)
  const statements = sellerStatements(saleRows)
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
    return { batchId: batch.id, ...totals, journalId: null as string | null, statements }
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
    date: settleDate,
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

  for (const statement of statements) {
    let purchaseDocumentId: string | null = null
    let billPaymentId: string | null = null
    if (new Decimal(statement.sellerPayable).greaterThan(0)) {
      const bill = await purchaseService.create(ctx, 'BILL', {
        number: undefined,
        vendorId: statement.vendorId,
        date: settleDate,
        reference: `MKT-${batch.id.slice(-10)}`,
        memo: batch.memo,
        acknowledgeDuplicate: true,
        saveAsDraft: false,
        lines: [
          {
            expenseAccountId: commissionPayableId,
            description: 'Seller share (marketplace settlement)',
            quantity: '1',
            unitPrice: statement.sellerPayable,
          },
        ],
      })
      purchaseDocumentId = bill.id
      if (input.paymentAccountId) {
        const pay = await billPaymentService.create(ctx, {
          number: undefined,
          vendorId: statement.vendorId,
          date: settleDate,
          amount: statement.sellerPayable,
          method: 'BANK_TRANSFER',
          paymentAccountId: input.paymentAccountId,
          memo: batch.memo,
          acknowledgeDuplicate: true,
          applications: [{ billId: bill.id, amount: statement.sellerPayable }],
        })
        billPaymentId = pay.id
      }
    }
    await db.settlementSellerLine.create({
      data: {
        orgId: ctx.orgId,
        batchId: batch.id,
        vendorId: statement.vendorId,
        grossSales: statement.grossSales,
        commission: statement.commission,
        sellerPayable: statement.sellerPayable,
        purchaseDocumentId,
        billPaymentId,
      },
    })
  }

  await db.settlementBatch.update({
    where: { id: batch.id },
    data: { status: 'POSTED', journalId: journal.id },
  })

  return { batchId: batch.id, ...totals, journalId: journal.id, statements }
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
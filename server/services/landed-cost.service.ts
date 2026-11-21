import 'server-only'

import { toCalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import type { AllocateLandedCostInput } from '@/lib/validation/purchases'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import { positionOf, recordMovement } from '@/server/accounting/inventory'
import { postJournal, type DraftLine } from '@/server/accounting/posting'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import * as storeService from '@/server/services/store.service'

const STOCKED = new Set(['INVENTORY', 'INVENTORY_ASSEMBLY'])
const POSTED_BILL = new Set(['OPEN', 'PARTIAL', 'PAID'])

export type LandedCostReceiptCandidate = {
  itemId: string
  name: string
  sku: string | null
  storeId: string | null
  storeName: string | null
  onHand: string
  lastReceiveQty: string
  lastReceiveDate: string | null
}

export type LandedCostPreview = {
  bill: {
    id: string
    number: string
    date: string
    vendorId: string | null
    vendorName: string | null
    status: string
    poId: string | null
    poNumber: string | null
  }
  pool: string
  allocated: string
  remaining: string
  expenseAccountId: string | null
  expenseAccountName: string | null
  batches: {
    id: string
    postedAt: string
    memo: string | null
    journalId: string | null
    total: string
  }[]
  receipts: LandedCostReceiptCandidate[]
}

function isStockItem(type: string | null | undefined) {
  return Boolean(type && STOCKED.has(type))
}

/** Expense (freight/duty) pool on a posted bill — non-inventory line amounts. */
function expensePool(
  lines: { amount: { toString(): string }; item: { type: string } | null }[],
): Decimal {
  return lines.reduce((sum, line) => {
    if (isStockItem(line.item?.type)) return sum
    return sum.plus(line.amount.toString())
  }, ZERO)
}

async function allocatedOnBill(tx: Tx, orgId: string, billId: string): Promise<Decimal> {
  const rows = await tx.landedCostLine.findMany({
    where: { orgId, batch: { billId } },
    select: { amount: true },
  })
  return rows.reduce((sum, row) => sum.plus(row.amount.toString()), ZERO)
}

export async function preview(ctx: OrgContext, billId: string): Promise<LandedCostPreview> {
  return previewInTx(db as unknown as Tx, ctx, billId)
}

export async function previewInTx(
  tx: Tx,
  ctx: OrgContext,
  billId: string,
): Promise<LandedCostPreview> {
  const bill = await tx.purchaseDocument.findFirst({
    where: { id: billId, orgId: ctx.orgId },
    select: {
      id: true,
      type: true,
      number: true,
      date: true,
      status: true,
      vendorId: true,
      convertedFromId: true,
      vendor: { select: { displayName: true } },
      convertedFrom: { select: { id: true, number: true, type: true } },
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          amount: true,
          itemId: true,
          storeId: true,
          expenseAccountId: true,
          item: { select: { id: true, name: true, sku: true, type: true } },
          expenseAccount: { select: { id: true, code: true, name: true } },
        },
      },
    },
  })
  if (!bill) throw notFound('Bill')
  if (bill.type !== 'BILL') {
    throw validation('Landed cost can only be allocated from a bill.')
  }

  const pool = expensePool(bill.lines)
  const allocated = await allocatedOnBill(tx, ctx.orgId, bill.id)
  const remaining = Decimal.max(pool.minus(allocated), ZERO)

  const expenseLine = bill.lines.find((line) => !isStockItem(line.item?.type) && line.expenseAccount)
  const batches = await tx.landedCostBatch.findMany({
    where: { orgId: ctx.orgId, billId: bill.id },
    orderBy: { postedAt: 'desc' },
    select: {
      id: true,
      postedAt: true,
      memo: true,
      journalId: true,
      lines: { select: { amount: true } },
    },
  })

  const receipts = await receiptCandidates(tx, ctx, bill)

  return {
    bill: {
      id: bill.id,
      number: bill.number,
      date: toCalendarDate(bill.date),
      vendorId: bill.vendorId,
      vendorName: bill.vendor?.displayName ?? null,
      status: bill.status,
      poId: bill.convertedFrom?.id ?? null,
      poNumber: bill.convertedFrom?.number ?? null,
    },
    pool: pool.toFixed(4),
    allocated: allocated.toFixed(4),
    remaining: remaining.toFixed(4),
    expenseAccountId: expenseLine?.expenseAccount?.id ?? null,
    expenseAccountName: expenseLine?.expenseAccount
      ? `${expenseLine.expenseAccount.code} ${expenseLine.expenseAccount.name}`
      : null,
    batches: batches.map((row) => ({
      id: row.id,
      postedAt: row.postedAt.toISOString(),
      memo: row.memo,
      journalId: row.journalId,
      total: row.lines.reduce((sum, line) => sum.plus(line.amount.toString()), ZERO).toFixed(4),
    })),
    receipts,
  }
}

async function receiptCandidates(
  tx: Tx,
  ctx: OrgContext,
  bill: {
    id: string
    vendorId: string | null
    convertedFromId: string | null
    lines: { itemId: string | null; storeId: string | null; item: { id: string; name: string; sku: string | null; type: string } | null }[]
  },
): Promise<LandedCostReceiptCandidate[]> {
  const itemIds = new Set<string>()
  const storeByItem = new Map<string, string | null>()

  for (const line of bill.lines) {
    if (line.item && isStockItem(line.item.type)) {
      itemIds.add(line.item.id)
      if (!storeByItem.has(line.item.id)) storeByItem.set(line.item.id, line.storeId)
    }
  }

  if (bill.convertedFromId) {
    const poLines = await tx.purchaseDocumentLine.findMany({
      where: {
        orgId: ctx.orgId,
        documentId: bill.convertedFromId,
        item: { type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] } },
      },
      select: {
        itemId: true,
        storeId: true,
        quantityReceived: true,
        item: { select: { id: true } },
      },
    })
    for (const line of poLines) {
      if (!line.itemId) continue
      if (new Decimal(line.quantityReceived.toString()).isZero()) continue
      itemIds.add(line.itemId)
      if (!storeByItem.has(line.itemId)) storeByItem.set(line.itemId, line.storeId)
    }

    const siblingBills = await tx.purchaseDocument.findMany({
      where: {
        orgId: ctx.orgId,
        convertedFromId: bill.convertedFromId,
        type: 'BILL',
        deletedAt: null,
      },
      select: { id: true },
    })
    const siblingIds = siblingBills.map((row) => row.id)
    if (siblingIds.length > 0) {
      const siblingLines = await tx.purchaseDocumentLine.findMany({
        where: {
          orgId: ctx.orgId,
          documentId: { in: siblingIds },
          item: { type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] } },
        },
        select: { itemId: true, storeId: true },
      })
      for (const line of siblingLines) {
        if (!line.itemId) continue
        itemIds.add(line.itemId)
        if (!storeByItem.has(line.itemId)) storeByItem.set(line.itemId, line.storeId)
      }
    }
  }

  if (bill.vendorId) {
    const since = new Date()
    since.setUTCDate(since.getUTCDate() - 180)
    const vendorBills = await tx.purchaseDocument.findMany({
      where: {
        orgId: ctx.orgId,
        vendorId: bill.vendorId,
        type: 'BILL',
        deletedAt: null,
        date: { gte: since },
      },
      select: { id: true },
      take: 40,
    })
    const vendorBillIds = vendorBills.map((row) => row.id)
    if (vendorBillIds.length > 0) {
      const vendorLines = await tx.purchaseDocumentLine.findMany({
        where: {
          orgId: ctx.orgId,
          documentId: { in: vendorBillIds },
          item: { type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] } },
        },
        select: { itemId: true, storeId: true },
      })
      for (const line of vendorLines) {
        if (!line.itemId) continue
        itemIds.add(line.itemId)
        if (!storeByItem.has(line.itemId)) storeByItem.set(line.itemId, line.storeId)
      }
    }
  }

  const ids = [...itemIds]
  if (ids.length === 0) return []

  const items = await tx.item.findMany({
    where: {
      orgId: ctx.orgId,
      id: { in: ids },
      deletedAt: null,
      type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
    },
    select: { id: true, name: true, sku: true },
  })

  const lastMoves = await tx.inventoryTransaction.findMany({
    where: {
      orgId: ctx.orgId,
      itemId: { in: ids },
      type: 'PURCHASE',
    },
    orderBy: { sequence: 'desc' },
    distinct: ['itemId'],
    select: {
      itemId: true,
      quantity: true,
      date: true,
      storeId: true,
      store: { select: { name: true } },
    },
  })
  const lastByItem = new Map(lastMoves.map((row) => [row.itemId, row]))

  const storeIds = [
    ...new Set(
      [...storeByItem.values(), ...lastMoves.map((row) => row.storeId)].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ]
  const stores = storeIds.length
    ? await tx.store.findMany({
        where: { orgId: ctx.orgId, id: { in: storeIds } },
        select: { id: true, name: true },
      })
    : []
  const storeName = new Map(stores.map((row) => [row.id, row.name]))

  const rows: LandedCostReceiptCandidate[] = []
  for (const item of items) {
    const position = await positionOf(tx, item.id)
    const last = lastByItem.get(item.id)
    const storeId = last?.storeId ?? storeByItem.get(item.id) ?? null
    rows.push({
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      storeId,
      storeName: storeId ? (last?.store?.name ?? storeName.get(storeId) ?? null) : null,
      onHand: position.quantity.toFixed(4),
      lastReceiveQty: last ? last.quantity.toString() : '0',
      lastReceiveDate: last ? toCalendarDate(last.date) : null,
    })
  }

  rows.sort((a, b) => a.name.localeCompare(b.name))
  return rows
}

export async function allocate(ctx: OrgContext, input: AllocateLandedCostInput) {
  const meta = await requestMeta()
  return db.$transaction((tx) => allocateInTx(tx, ctx, input, meta))
}

/** Testable core — runs inside the caller's transaction. */
export async function allocateInTx(
  tx: Tx,
  ctx: OrgContext,
  input: AllocateLandedCostInput,
  meta?: Awaited<ReturnType<typeof requestMeta>>,
) {
  const audit = meta ?? (await requestMeta())
  const bill = await tx.purchaseDocument.findFirst({
    where: { id: input.billId, orgId: ctx.orgId },
    select: {
      id: true,
      type: true,
      number: true,
      date: true,
      status: true,
      journalId: true,
      deletedAt: true,
      lines: {
        select: {
          amount: true,
          expenseAccountId: true,
          item: { select: { type: true } },
          expenseAccount: { select: { id: true, code: true, name: true } },
        },
      },
    },
  })
  if (!bill || bill.deletedAt) throw notFound('Bill')
  if (bill.type !== 'BILL') {
    throw validation('Landed cost can only be allocated from a bill.')
  }
  if (!bill.journalId || !POSTED_BILL.has(bill.status)) {
    throw precondition(`${bill.number} must be posted before freight can be allocated to stock.`)
  }

  const pool = expensePool(bill.lines)
  if (pool.lte(0)) {
    throw validation(
      `${bill.number} has no freight/duty expense lines to allocate. Add a non-inventory line (freight, duty, or landing) on the bill.`,
    )
  }
  const already = await allocatedOnBill(tx, ctx.orgId, bill.id)
  const remaining = pool.minus(already)
  if (remaining.lte(0)) {
    throw precondition(`All freight on ${bill.number} has already been allocated to stock.`)
  }

  const merged = new Map<string, { itemId: string; storeId: string | null; amount: Decimal; quantity: Decimal | null }>()
  for (const line of input.lines) {
    const amount = new Decimal(line.amount)
    if (!amount.isPositive()) continue
    const storeId = line.storeId ?? null
    const key = `${line.itemId}:${storeId ?? ''}`
    const prior = merged.get(key)
    merged.set(key, {
      itemId: line.itemId,
      storeId,
      amount: (prior?.amount ?? ZERO).plus(amount),
      quantity: line.quantity ? new Decimal(line.quantity) : (prior?.quantity ?? null),
    })
  }
  const planned = [...merged.values()]
  if (planned.length === 0) {
    throw validation('Allocate at least one amount greater than zero.')
  }

  const total = planned.reduce((sum, line) => sum.plus(line.amount), ZERO)
  if (total.greaterThan(remaining)) {
    throw validation(
      `Allocated ${total.toFixed(2)} exceeds the remaining freight on ${bill.number} (${remaining.toFixed(2)}).`,
    )
  }

  const items = await tx.item.findMany({
    where: { orgId: ctx.orgId, id: { in: planned.map((line) => line.itemId) } },
    select: {
      id: true,
      name: true,
      type: true,
      inventoryAccountId: true,
    },
  })
  const byId = new Map(items.map((item) => [item.id, item]))
  for (const line of planned) {
    const item = byId.get(line.itemId)
    if (!item) throw validation('That item does not exist.')
    if (!isStockItem(item.type)) {
      throw validation(`"${item.name}" is not a tracked item, so freight cannot land on it.`)
    }
    if (!item.inventoryAccountId) {
      throw precondition(`"${item.name}" has no inventory account.`)
    }
    const position = await positionOf(tx, item.id)
    if (position.quantity.lte(0)) {
      throw precondition(
        `"${item.name}" has no stock on hand to carry an added cost. Receive the goods first.`,
      )
    }
  }

  const expenseLine = bill.lines.find((line) => !isStockItem(line.item?.type) && line.expenseAccountId)
  const clearingAccountId =
    expenseLine?.expenseAccountId ?? (await systemAccountId(tx, ctx.orgId, 'UNCATEGORISED_EXPENSE'))

  const storeAccounts = await storeService.accountsFor(
    tx,
    ctx.orgId,
    planned.map((line) => line.storeId),
  )

  const batch = await tx.landedCostBatch.create({
    data: {
      orgId: ctx.orgId,
      billId: bill.id,
      memo: input.memo ?? null,
      createdById: ctx.userId,
      lines: {
        create: planned.map((line) => ({
          orgId: ctx.orgId,
          itemId: line.itemId,
          storeId: line.storeId,
          amount: line.amount.toFixed(4),
          quantity: line.quantity ? line.quantity.toFixed(4) : null,
        })),
      },
    },
    select: { id: true },
  })

  const date = toCalendarDate(bill.date)
  const stockLines = new Map<string, Decimal>()
  let postedValue = ZERO

  for (const line of planned) {
    const item = byId.get(line.itemId)!
    const movement = await recordMovement(tx, ctx, {
      itemId: line.itemId,
      date,
      type: 'ADJUSTMENT',
      sourceType: 'LANDED_COST',
      sourceId: batch.id,
      quantity: ZERO,
      valueOverride: line.amount,
      storeId: line.storeId,
    })
    const inventoryAccountId =
      (line.storeId && storeAccounts.get(line.storeId)) || item.inventoryAccountId!
    stockLines.set(
      inventoryAccountId,
      (stockLines.get(inventoryAccountId) ?? ZERO).plus(movement.value),
    )
    postedValue = postedValue.plus(movement.value)
  }

  const journalLines: DraftLine[] = []
  for (const [inventoryAccountId, value] of stockLines) {
    if (value.isZero()) continue
    journalLines.push({
      accountId: inventoryAccountId,
      debit: value,
      description: `Landed cost ${bill.number}`,
    })
  }
  if (!postedValue.isZero()) {
    journalLines.push({
      accountId: clearingAccountId,
      credit: postedValue,
      description: input.memo?.trim() || `Landed cost ${bill.number}`,
    })
  }

  if (journalLines.length < 2) {
    throw precondition('Nothing to post — allocated amounts rounded to zero.')
  }

  const journal = await postJournal(tx, ctx, {
    date,
    memo: `Landed cost ${bill.number}${input.memo ? ` — ${input.memo}` : ''}`,
    sourceType: 'LANDED_COST',
    sourceId: batch.id,
    lines: journalLines,
  })

  await tx.landedCostBatch.update({
    where: { id: batch.id },
    data: { journalId: journal.id },
  })
  await tx.inventoryTransaction.updateMany({
    where: { orgId: ctx.orgId, sourceId: batch.id, journalId: null },
    data: { journalId: journal.id },
  })

  await writeAudit(
    tx,
    ctx,
    {
      entity: 'LandedCostBatch',
      entityId: batch.id,
      action: 'CREATE',
      after: {
        billId: bill.id,
        billNumber: bill.number,
        total: postedValue.toString(),
        lines: planned.length,
      },
    },
    audit,
  )

  return {
    id: batch.id,
    billId: bill.id,
    journalId: journal.id,
    total: postedValue.toFixed(4),
  }
}

export async function hasAllocations(tx: Tx, orgId: string, billId: string): Promise<boolean> {
  const count = await tx.landedCostBatch.count({ where: { orgId, billId } })
  return count > 0
}

export async function listForOrg(ctx: OrgContext) {
  const rows = await db.landedCostBatch.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { postedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      postedAt: true,
      memo: true,
      journalId: true,
      bill: {
        select: {
          id: true,
          number: true,
          vendor: { select: { displayName: true } },
        },
      },
      journal: { select: { journalNumber: true } },
      lines: { select: { amount: true } },
    },
  })
  return rows.map((row) => ({
    id: row.id,
    postedAt: row.postedAt.toISOString(),
    memo: row.memo,
    billId: row.bill.id,
    billNumber: row.bill.number,
    vendorName: row.bill.vendor?.displayName ?? null,
    journalId: row.journalId,
    journalNumber: row.journal?.journalNumber ?? null,
    total: row.lines.reduce((sum, line) => sum.plus(line.amount.toString()), ZERO).toFixed(4),
  }))
}

import 'server-only'

import { today } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import {
  binCodeValid,
  canCancelPick,
  canCompletePick,
  canStartPick,
  type PickStatus,
} from '@/lib/erp/wms-pick'
import { positionOf, recordMovement } from '@/server/accounting/inventory'
import { postJournal, type DraftLine } from '@/server/accounting/posting'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'
import * as storeService from '@/server/services/store.service'

export async function listBoard(ctx: OrgContext) {
  const [stores, bins, picks, items, openOrders] = await Promise.all([
    db.store.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.stockBin.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { code: 'asc' },
      include: { store: { select: { name: true } } },
      take: 80,
    }),
    db.pickTask.findMany({
      where: { orgId: ctx.orgId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        item: { select: { name: true, trackLots: true, trackSerials: true } },
        store: { select: { name: true } },
        bin: { select: { code: true } },
      },
      take: 80,
    }),
    db.item.findMany({
      where: {
        orgId: ctx.orgId,
        isActive: true,
        deletedAt: null,
        type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
      },
      select: { id: true, name: true, trackLots: true, trackSerials: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    db.salesDocument.findMany({
      where: {
        orgId: ctx.orgId,
        type: 'SALES_ORDER',
        status: { in: ['OPEN', 'PARTIAL'] },
        deletedAt: null,
      },
      select: { id: true, number: true },
      orderBy: { date: 'desc' },
      take: 40,
    }),
  ])
  return {
    stores,
    bins,
    picks: picks.map((row) => ({
      ...row,
      qty: row.qty.toString(),
    })),
    items,
    openOrders,
  }
}

export async function createBin(
  ctx: OrgContext,
  input: { storeId: string; code: string; name: string },
) {
  const code = input.code.trim().toUpperCase()
  if (!binCodeValid(code)) throw validation('Bin code: letters, numbers, dot or dash.')
  const store = await db.store.findFirst({
    where: { id: input.storeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!store) throw notFound('Store')
  const name = input.name.trim() || code
  return db.stockBin.create({
    data: { orgId: ctx.orgId, storeId: store.id, code, name },
    select: { id: true },
  })
}

export async function createPick(
  ctx: OrgContext,
  input: {
    storeId: string
    itemId: string
    qty: string
    binId?: string | null
    sourceType?: string | null
    sourceId?: string | null
    lotNumber?: string | null
    serialNumber?: string | null
  },
) {
  const qty = new Decimal(input.qty)
  if (qty.lessThanOrEqualTo(0)) throw validation('Quantity must be greater than zero.')
  const store = await db.store.findFirst({
    where: { id: input.storeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!store) throw notFound('Store')
  const item = await db.item.findFirst({
    where: { id: input.itemId, orgId: ctx.orgId, deletedAt: null },
    select: { id: true, trackLots: true, trackSerials: true },
  })
  if (!item) throw notFound('Item')

  let binId: string | null = null
  if (input.binId) {
    const bin = await db.stockBin.findFirst({
      where: { id: input.binId, orgId: ctx.orgId, storeId: store.id },
      select: { id: true },
    })
    if (!bin) throw notFound('Bin')
    binId = bin.id
  }

  let sourceType = input.sourceType?.trim() || null
  let sourceId = input.sourceId?.trim() || null
  if (sourceType || sourceId) {
    if (sourceType !== 'SALES_ORDER' && sourceType !== 'DELIVERY_NOTE') {
      throw validation('Pick source must be a sales order or delivery note.')
    }
    if (!sourceId) throw validation('Choose the sales order or delivery for this pick.')
    if (sourceType === 'SALES_ORDER') {
      const so = await db.salesDocument.findFirst({
        where: {
          id: sourceId,
          orgId: ctx.orgId,
          type: 'SALES_ORDER',
          deletedAt: null,
        },
        select: { id: true },
      })
      if (!so) throw notFound('Sales order')
    } else {
      const note = await db.deliveryNote.findFirst({
        where: { id: sourceId, orgId: ctx.orgId },
        select: { id: true },
      })
      if (!note) throw notFound('Delivery note')
    }
  }

  const lotNumber = input.lotNumber?.trim() || null
  const serialNumber = input.serialNumber?.trim() || null
  if (item.trackLots && !lotNumber) {
    throw validation('This item tracks lots — enter a lot number.')
  }
  if (item.trackSerials && !serialNumber) {
    throw validation('This item tracks serials — enter a serial number.')
  }

  return db.pickTask.create({
    data: {
      orgId: ctx.orgId,
      storeId: store.id,
      itemId: item.id,
      binId,
      qty: qty.toFixed(4),
      sourceType,
      sourceId,
      lotNumber,
      serialNumber,
    },
    select: { id: true },
  })
}

/** Create a pick from an open sales order line (optional SO link helper). */
export async function createPickFromSalesOrder(
  ctx: OrgContext,
  input: { salesOrderId: string; lineId: string; storeId: string; binId?: string | null },
) {
  const line = await db.salesDocumentLine.findFirst({
    where: {
      id: input.lineId,
      orgId: ctx.orgId,
      documentId: input.salesOrderId,
      document: { type: 'SALES_ORDER', deletedAt: null },
    },
    select: {
      id: true,
      itemId: true,
      quantity: true,
      lotNumber: true,
      serialNumber: true,
      item: { select: { type: true } },
    },
  })
  if (!line?.itemId) throw notFound('Sales order line')
  if (line.item?.type !== 'INVENTORY' && line.item?.type !== 'INVENTORY_ASSEMBLY') {
    throw validation('Only stocked items can be picked.')
  }
  return createPick(ctx, {
    storeId: input.storeId,
    itemId: line.itemId,
    qty: line.quantity.toString(),
    binId: input.binId,
    sourceType: 'SALES_ORDER',
    sourceId: input.salesOrderId,
    lotNumber: line.lotNumber,
    serialNumber: line.serialNumber,
  })
}

export async function startPick(ctx: OrgContext, id: string) {
  const row = await db.pickTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Pick')
  if (!canStartPick(row.status as PickStatus)) throw precondition('This pick cannot start.')
  return db.pickTask.update({
    where: { id: row.id },
    data: { status: 'PICKING' },
    select: { id: true },
  })
}

export async function completePick(ctx: OrgContext, id: string) {
  return db.$transaction((tx) => completePickInTx(tx, ctx, id))
}

/** Testable core — runs inside the caller's transaction. */
export async function completePickInTx(tx: Tx, ctx: OrgContext, id: string) {
  const row = await tx.pickTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      status: true,
      qty: true,
      storeId: true,
      itemId: true,
      lotNumber: true,
      serialNumber: true,
      item: {
        select: {
          id: true,
          name: true,
          inventoryAccountId: true,
          cogsAccountId: true,
        },
      },
    },
  })
  if (!row) throw notFound('Pick')
  if (!canCompletePick(row.status as PickStatus)) throw precondition('This pick cannot complete.')

  const qty = new Decimal(row.qty.toString())
  const position = await positionOf(tx, row.itemId)
  if (!ctx.organization.allowNegativeStock && qty.greaterThan(position.quantity)) {
    throw precondition(
      `Only ${position.quantity.toFixed(2)} of "${row.item.name}" on hand; pick needs ${qty.toFixed(2)}.`,
    )
  }

  if (!row.item.inventoryAccountId || !row.item.cogsAccountId) {
    throw precondition(`"${row.item.name}" needs inventory and COGS accounts to pick.`)
  }

  const date = today(ctx.organization.timeZone)
  const storeAccounts = await storeService.accountsFor(tx, ctx.orgId, [row.storeId])
  const inventoryAccountId =
    storeAccounts.get(row.storeId) || row.item.inventoryAccountId

  const movement = await recordMovement(tx, ctx, {
    itemId: row.itemId,
    date,
    type: 'ADJUSTMENT',
    sourceType: 'INVENTORY_ADJUSTMENT',
    sourceId: row.id,
    quantity: qty.negated(),
    storeId: row.storeId,
    lotNumber: row.lotNumber,
    serialNumber: row.serialNumber,
  })

  const absValue = movement.value.abs()
  if (absValue.greaterThan(ZERO)) {
    const lines: DraftLine[] = [
      {
        accountId: row.item.cogsAccountId,
        debit: absValue,
        description: `Pick · ${row.item.name}`,
      },
      {
        accountId: inventoryAccountId,
        credit: absValue,
        description: `Pick · ${row.item.name}`,
      },
    ]
    const journal = await postJournal(tx, ctx, {
      date,
      memo: `Warehouse pick · ${row.item.name}`,
      sourceType: 'INVENTORY_ADJUSTMENT',
      sourceId: row.id,
      lines,
    })
    await tx.inventoryTransaction.updateMany({
      where: { orgId: ctx.orgId, sourceId: row.id, journalId: null },
      data: { journalId: journal.id },
    })
  }

  return tx.pickTask.update({
    where: { id: row.id },
    data: { status: 'PICKED' },
    select: { id: true },
  })
}

export async function cancelPick(ctx: OrgContext, id: string) {
  const row = await db.pickTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Pick')
  if (!canCancelPick(row.status as PickStatus)) throw precondition('This pick cannot cancel.')
  return db.pickTask.update({
    where: { id: row.id },
    data: { status: 'CANCELLED' },
    select: { id: true },
  })
}

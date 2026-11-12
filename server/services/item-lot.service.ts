import 'server-only'

import { toDate, today } from '@/lib/date'
import { onHandByLot } from '@/lib/inventory-lot-serial'
import { daysUntilExpiry, isLotExpired } from '@/lib/erp/pharmacy'
import { Decimal } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import type { Tx } from '@/server/db'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'
import * as inventoryService from '@/server/services/inventory.service'

/** Upsert lot expiry when stock is received (purchase / opening). */
export async function upsertItemLot(
  tx: Tx,
  orgId: string,
  input: { itemId: string; lotNumber: string; expiryDate?: string | Date | null },
) {
  const lotNumber = input.lotNumber.trim()
  if (!lotNumber) return null

  const expiryDate = input.expiryDate
    ? typeof input.expiryDate === 'string'
      ? toDate(input.expiryDate)
      : input.expiryDate
    : null

  return tx.itemLot.upsert({
    where: {
      orgId_itemId_lotNumber: { orgId, itemId: input.itemId, lotNumber },
    },
    create: {
      orgId,
      itemId: input.itemId,
      lotNumber,
      expiryDate,
    },
    update: expiryDate ? { expiryDate } : {},
  })
}

export async function listExpiringLots(
  ctx: OrgContext,
  options: { withinDays?: number; asOf?: string } = {},
) {
  const withinDays = options.withinDays ?? 90
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10)
  const lots = await db.itemLot.findMany({
    where: {
      orgId: ctx.orgId,
      expiryDate: { not: null },
      item: { deletedAt: null, isActive: true },
    },
    include: {
      item: { select: { id: true, name: true, sku: true, pharmacyControlled: true } },
    },
    orderBy: { expiryDate: 'asc' },
    take: 500,
  })

  return lots
    .filter((lot) => !lot.disposedAt)
    .map((lot) => {
      const days = daysUntilExpiry(lot.expiryDate, asOf)
      return {
        id: lot.id,
        itemId: lot.itemId,
        itemName: lot.item.name,
        sku: lot.item.sku,
        pharmacyControlled: lot.item.pharmacyControlled,
        lotNumber: lot.lotNumber,
        expiryDate: lot.expiryDate?.toISOString().slice(0, 10) ?? null,
        daysUntilExpiry: days,
        expired: isLotExpired(lot.expiryDate, asOf),
      }
    })
    .filter((row) => row.daysUntilExpiry != null && row.daysUntilExpiry <= withinDays)
}

/**
 * Write off remaining on-hand qty for an expired (or selected) lot via a damage
 * adjustment, then stamp the lot as disposed.
 */
export async function disposeExpiredLot(
  ctx: OrgContext,
  input: { lotId: string; quantity?: string; storeId?: string | null },
) {
  const lot = await db.itemLot.findFirst({
    where: { id: input.lotId, orgId: ctx.orgId },
    include: { item: { select: { id: true, name: true, type: true } } },
  })
  if (!lot) throw notFound('Lot')
  if (lot.disposedAt) throw conflict('This lot was already disposed.')
  if (lot.item.type !== 'INVENTORY') {
    throw validation(`“${lot.item.name}” is not a tracked inventory item.`)
  }

  const movements = await db.inventoryTransaction.findMany({
    where: { orgId: ctx.orgId, itemId: lot.itemId, lotNumber: lot.lotNumber },
    select: { quantity: true, lotNumber: true },
  })
  const onHandMap = onHandByLot(
    movements.map((row) => ({
      lotNumber: row.lotNumber,
      quantity: row.quantity.toString(),
    })),
  )
  const onHand = onHandMap.get(lot.lotNumber) ?? new Decimal(0)
  if (onHand.lessThanOrEqualTo(0)) {
    throw precondition('No on-hand quantity left for this lot.')
  }

  const disposeQty = input.quantity?.trim()
    ? new Decimal(input.quantity)
    : onHand
  if (disposeQty.lessThanOrEqualTo(0)) throw validation('Disposal quantity must be more than zero.')
  if (disposeQty.greaterThan(onHand)) {
    throw validation(`Only ${onHand.toFixed(4)} remains on hand for lot ${lot.lotNumber}.`)
  }

  const adjustment = await inventoryService.createAdjustment(ctx, {
    number: undefined,
    date: today(ctx.organization.timeZone),
    mode: 'damage',
    storeId: input.storeId || null,
    reason: `Expired lot disposal · ${lot.lotNumber}`,
    memo: `Write-off lot ${lot.lotNumber} for ${lot.item.name}`,
    lines: [
      {
        itemId: lot.itemId,
        countedQuantity: disposeQty.toFixed(4),
        description: `Dispose lot ${lot.lotNumber}`,
      },
    ],
  })

  const posted = await db.inventoryAdjustment.findFirst({
    where: { id: adjustment.id, orgId: ctx.orgId },
    select: { journalId: true },
  })
  if (!posted?.journalId) {
    throw precondition(
      'Disposal is waiting for approval. Approve the stock adjustment, then dispose again if needed.',
    )
  }

  await db.itemLot.update({
    where: { id: lot.id },
    data: {
      disposedAt: new Date(),
      disposedQuantity: disposeQty,
    },
  })

  return {
    lotId: lot.id,
    adjustmentId: adjustment.id,
    quantity: disposeQty.toFixed(4),
  }
}

export async function listControlledItems(ctx: OrgContext) {
  return db.item.findMany({
    where: {
      orgId: ctx.orgId,
      pharmacyControlled: true,
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      trackLots: true,
      reorderPoint: true,
    },
    orderBy: { name: 'asc' },
  })
}

/** Recent stock movements for pharmacy-controlled products (dispense / receive audit). */
export async function listControlledMovements(ctx: OrgContext, limit = 100) {
  const controlled = await db.item.findMany({
    where: {
      orgId: ctx.orgId,
      pharmacyControlled: true,
      deletedAt: null,
    },
    select: { id: true },
    take: 500,
  })
  if (controlled.length === 0) return []

  const itemIds = controlled.map((row) => row.id)
  const rows = await db.inventoryTransaction.findMany({
    where: { orgId: ctx.orgId, itemId: { in: itemIds } },
    orderBy: [{ date: 'desc' }, { sequence: 'desc' }],
    take: limit,
    select: {
      id: true,
      date: true,
      type: true,
      quantity: true,
      lotNumber: true,
      item: { select: { id: true, name: true, sku: true } },
      journal: { select: { id: true, journalNumber: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    type: row.type,
    quantity: row.quantity.toString(),
    lotNumber: row.lotNumber,
    itemId: row.item.id,
    itemName: row.item.name,
    sku: row.item.sku,
    journalId: row.journal?.id ?? null,
    journalNumber: row.journal?.journalNumber ?? null,
  }))
}

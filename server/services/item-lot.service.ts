import 'server-only'

import { toDate } from '@/lib/date'
import { daysUntilExpiry, isLotExpired } from '@/lib/erp/pharmacy'
import type { OrgContext } from '@/server/auth/context'
import type { Tx } from '@/server/db'
import { db } from '@/server/db'

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

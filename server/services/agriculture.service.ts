import 'server-only'

import { filterSeasonalRows, totalSeasonalCost, type SeasonalLotRow } from '@/lib/erp/agriculture'
import { Decimal } from '@/lib/money'
import { onHandByLot } from '@/lib/inventory-lot-serial'
import { positionOf } from '@/server/accounting/inventory'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'

export async function seasonalCostReport(
  ctx: OrgContext,
  options: {
    storeId?: string | null
    originQuery?: string | null
    projectId?: string | null
    trackingCategoryId?: string | null
  } = {},
) {
  const farmStores = await db.store.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      isFarm: true,
      ...(options.storeId ? { id: options.storeId } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  if (farmStores.length === 0) {
    return {
      rows: [] as SeasonalLotRow[],
      totalCost: '0.00',
      farmStoreCount: 0,
      farmStores: [] as { id: string; name: string }[],
    }
  }

  const lots = await db.itemLot.findMany({
    where: { orgId: ctx.orgId, disposedAt: null },
    select: {
      id: true,
      lotNumber: true,
      originLabel: true,
      trackingCategoryId: true,
      projectId: true,
      itemId: true,
      item: { select: { name: true, trackLots: true } },
    },
    orderBy: [{ item: { name: 'asc' } }, { lotNumber: 'asc' }],
    take: 500,
  })

  const tx = db as unknown as Tx
  const rows: SeasonalLotRow[] = []

  for (const store of farmStores) {
    for (const lot of lots) {
      if (!lot.item.trackLots) continue
      const movements = await db.inventoryTransaction.findMany({
        where: {
          orgId: ctx.orgId,
          itemId: lot.itemId,
          storeId: store.id,
          lotNumber: lot.lotNumber,
        },
        select: { quantity: true, lotNumber: true },
        orderBy: { sequence: 'asc' },
        take: 5000,
      })
      const byLot = onHandByLot(
        movements.map((row) => ({ lotNumber: row.lotNumber, quantity: row.quantity })),
      )
      const qty = byLot.get(lot.lotNumber)?.toString() ?? byLot.get('')?.toString() ?? '0'
      if (new Decimal(qty).lessThanOrEqualTo(0)) continue
      const pos = await positionOf(tx, lot.itemId)
      const avg = pos.quantity.isZero()
        ? new Decimal(0)
        : pos.value.dividedBy(pos.quantity).toDecimalPlaces(6)
      rows.push({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        originLabel: lot.originLabel,
        projectId: lot.projectId,
        trackingCategoryId: lot.trackingCategoryId,
        itemId: lot.itemId,
        itemName: lot.item.name,
        storeId: store.id,
        storeName: store.name,
        quantity: qty,
        averageCost: avg.toFixed(6),
      })
    }
  }

  const filtered = filterSeasonalRows(rows, options)
  return {
    rows: filtered,
    totalCost: totalSeasonalCost(filtered),
    farmStoreCount: farmStores.length,
    farmStores,
  }
}

/** Tag a harvest lot to a season project and/or class. */
export async function linkLotSeason(
  ctx: OrgContext,
  input: { lotId: string; projectId?: string | null; trackingCategoryId?: string | null },
) {
  const lot = await db.itemLot.findFirst({
    where: { id: input.lotId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!lot) return null

  if (input.projectId) {
    const project = await db.project.findFirst({
      where: { id: input.projectId, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!project) return null
  }
  if (input.trackingCategoryId) {
    const cls = await db.trackingCategory.findFirst({
      where: { id: input.trackingCategoryId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!cls) return null
  }

  return db.itemLot.update({
    where: { id: lot.id },
    data: {
      projectId: input.projectId || null,
      trackingCategoryId: input.trackingCategoryId || null,
    },
    select: { id: true, projectId: true, trackingCategoryId: true },
  })
}
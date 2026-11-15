import 'server-only'

import { filterSeasonalRows, totalSeasonalCost, type SeasonalLotRow } from '@/lib/erp/agriculture'
import { Decimal } from '@/lib/money'
import { onHandByLot } from '@/lib/inventory-lot-serial'
import { positionOf } from '@/server/accounting/inventory'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'

export async function seasonalCostReport(
  ctx: OrgContext,
  options: { storeId?: string | null; originQuery?: string | null } = {},
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
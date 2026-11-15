import 'server-only'

import { groupFoodCost, menuMarginPercent } from '@/lib/erp/menu-cost'
import { Decimal } from '@/lib/money'
import { positionOf } from '@/server/accounting/inventory'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'

export async function menuCostReport(ctx: OrgContext) {
  const items = await db.item.findMany({
    where: {
      orgId: ctx.orgId,
      deletedAt: null,
      isActive: true,
      type: 'GROUP',
    },
    select: {
      id: true,
      name: true,
      sku: true,
      salesPrice: true,
      bomParents: {
        select: {
          quantity: true,
          componentItemId: true,
          component: { select: { id: true, name: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
    take: 500,
  })

  const tx = db as unknown as Tx
  const rows = []
  for (const item of items) {
    const components = []
    for (const line of item.bomParents) {
      const pos = await positionOf(tx, line.componentItemId)
      const avg = pos.quantity.isZero()
        ? new Decimal(0)
        : pos.value.dividedBy(pos.quantity).toDecimalPlaces(6)
      components.push({
        componentItemId: line.componentItemId,
        name: line.component.name,
        quantity: line.quantity.toString(),
        averageCost: avg.toFixed(6),
      })
    }
    const foodCost = groupFoodCost(
      components.map((row) => ({
        componentItemId: row.componentItemId,
        quantity: row.quantity,
        averageCost: row.averageCost,
      })),
    )
    const price = item.salesPrice?.toString() ?? null
    const marginPct = menuMarginPercent(price, foodCost)
    rows.push({
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      salesPrice: price,
      foodCost,
      marginPercent: marginPct,
      components,
    })
  }

  return { rows, currency: ctx.organization.baseCurrency }
}
import 'server-only'

import { toDate, today, type CalendarDate } from '@/lib/date'
import {
  groupFoodCost,
  menuMarginPercent,
  periodFoodCostPercent,
  recipeVsActualVariance,
} from '@/lib/erp/menu-cost'
import { Decimal, ZERO } from '@/lib/money'
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

/** Period food-cost %: BOM component SALE issues vs GROUP / POS sales. */
export async function periodFoodCostReport(
  ctx: OrgContext,
  options: { from?: string | null; to?: string | null } = {},
) {
  const tz = ctx.organization.timeZone
  const toDay = (options.to?.trim() || today(tz)) as CalendarDate
  const fromDay = (options.from?.trim() || `${toDay.slice(0, 8)}01`) as CalendarDate
  const from = toDate(fromDay)
  const to = toDate(toDay)

  const groups = await db.item.findMany({
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
      bomParents: {
        select: {
          quantity: true,
          componentItemId: true,
          component: { select: { id: true, name: true } },
        },
      },
    },
    take: 500,
  })

  const groupIds = groups.map((row) => row.id)
  const componentIds = [
    ...new Set(groups.flatMap((row) => row.bomParents.map((line) => line.componentItemId))),
  ]

  const saleLines =
    groupIds.length === 0
      ? []
      : await db.salesDocumentLine.findMany({
          where: {
            orgId: ctx.orgId,
            itemId: { in: groupIds },
            document: {
              deletedAt: null,
              type: { in: ['INVOICE', 'SALES_RECEIPT'] },
              date: { gte: from, lte: to },
            },
          },
          select: {
            itemId: true,
            quantity: true,
            amount: true,
            document: { select: { id: true, posOrder: { select: { id: true } } } },
          },
          take: 8000,
        })

  const qtyByGroup = new Map<string, Decimal>()
  let groupSales = ZERO
  let posSales = ZERO
  for (const line of saleLines) {
    if (!line.itemId) continue
    qtyByGroup.set(line.itemId, (qtyByGroup.get(line.itemId) ?? ZERO).plus(line.quantity))
    const amount = new Decimal(line.amount.toString())
    groupSales = groupSales.plus(amount)
    if (line.document.posOrder) posSales = posSales.plus(amount)
  }

  const tx = db as unknown as Tx
  let recipeExpected = ZERO
  const recipeByComponent = new Map<string, Decimal>()
  for (const group of groups) {
    const soldQty = qtyByGroup.get(group.id) ?? ZERO
    if (soldQty.isZero()) continue
    for (const line of group.bomParents) {
      const pos = await positionOf(tx, line.componentItemId)
      const avg = pos.quantity.isZero()
        ? new Decimal(0)
        : pos.value.dividedBy(pos.quantity).toDecimalPlaces(6)
      const expected = soldQty.times(line.quantity).times(avg)
      recipeExpected = recipeExpected.plus(expected)
      recipeByComponent.set(
        line.componentItemId,
        (recipeByComponent.get(line.componentItemId) ?? ZERO).plus(soldQty.times(line.quantity)),
      )
    }
  }

  const issues =
    componentIds.length === 0
      ? []
      : await db.inventoryTransaction.findMany({
          where: {
            orgId: ctx.orgId,
            type: 'SALE',
            itemId: { in: componentIds },
            date: { gte: from, lte: to },
          },
          select: { itemId: true, quantity: true, value: true },
          take: 20_000,
        })

  let actualIssues = ZERO
  const issuedQtyByComponent = new Map<string, Decimal>()
  for (const row of issues) {
    actualIssues = actualIssues.plus(new Decimal(row.value.toString()).abs())
    issuedQtyByComponent.set(
      row.itemId,
      (issuedQtyByComponent.get(row.itemId) ?? ZERO).plus(new Decimal(row.quantity.toString()).abs()),
    )
  }

  const componentRows = componentIds.map((id) => {
    const group = groups.find((row) => row.bomParents.some((line) => line.componentItemId === id))
    const name =
      group?.bomParents.find((line) => line.componentItemId === id)?.component.name ?? id
    const recipeQty = recipeByComponent.get(id) ?? ZERO
    const actualQty = issuedQtyByComponent.get(id) ?? ZERO
    return {
      componentItemId: id,
      name,
      recipeQuantity: recipeQty.toFixed(4),
      actualQuantity: actualQty.toFixed(4),
      varianceQuantity: recipeVsActualVariance(recipeQty.toString(), actualQty.toString()),
    }
  }).filter((row) => row.recipeQuantity !== '0.0000' || row.actualQuantity !== '0.0000')

  const sales = groupSales
  return {
    from: fromDay,
    to: toDay,
    groupSales: groupSales.toFixed(2),
    posSales: posSales.toFixed(2),
    recipeExpected: recipeExpected.toFixed(2),
    actualIssues: actualIssues.toFixed(2),
    variance: recipeVsActualVariance(recipeExpected.toString(), actualIssues.toString()),
    foodCostPercent: periodFoodCostPercent(actualIssues.toString(), sales.toString()),
    componentRows,
  }
}
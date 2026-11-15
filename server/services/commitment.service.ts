import 'server-only'

import { commitmentVsBudget } from '@/lib/erp/commitment-budget'
import { Decimal } from '@/lib/money'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export async function commitmentReport(ctx: OrgContext) {
  assertPermission(ctx, 'report:read')

  const openPos = await db.purchaseDocument.findMany({
    where: {
      orgId: ctx.orgId,
      type: 'PURCHASE_ORDER',
      encumbered: true,
      deletedAt: null,
      status: { in: ['OPEN', 'PARTIAL', 'PENDING_APPROVAL'] },
    },
    select: {
      total: true,
      trackingCategoryId: true,
      trackingCategory: { select: { id: true, name: true } },
    },
  })

  const openPoByCategory = new Map<string | null, Decimal>()
  const categoryNames = new Map<string | null, string | null>()
  for (const row of openPos) {
    const key = row.trackingCategoryId
    const prev = openPoByCategory.get(key) ?? new Decimal(0)
    openPoByCategory.set(key, prev.plus(row.total))
    if (key && row.trackingCategory) categoryNames.set(key, row.trackingCategory.name)
    if (!key) categoryNames.set(null, 'Unclassified')
  }

  const budgets = await db.budget.findMany({
    where: { orgId: ctx.orgId },
    include: {
      lines: { select: { amount: true } },
      trackingCategory: { select: { id: true, name: true } },
    },
    orderBy: { startDate: 'desc' },
    take: 20,
  })

  const budgetByCategory: { trackingCategoryId: string | null; amount: string }[] = []
  for (const budget of budgets) {
    const total = budget.lines.reduce(
      (sum, line) => sum.plus(new Decimal(line.amount.toString())),
      new Decimal(0),
    )
    const key = budget.trackingCategoryId
    budgetByCategory.push({
      trackingCategoryId: key,
      amount: total.toFixed(4),
    })
    if (key && budget.trackingCategory) categoryNames.set(key, budget.trackingCategory.name)
  }

  const rows = commitmentVsBudget({
    openPoByCategory: [...openPoByCategory.entries()].map(([trackingCategoryId, total]) => ({
      trackingCategoryId,
      total: total.toFixed(4),
    })),
    budgetByCategory,
    categoryNames,
  })

  return { rows, openPoCount: openPos.length, budgetCount: budgets.length }
}
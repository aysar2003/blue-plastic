import { Decimal, ZERO } from '@/lib/money'

export type CommitmentBucket = {
  trackingCategoryId: string | null
  trackingCategoryName: string | null
  openPoTotal: string
  budgetAmount: string
  remaining: string
}

/** Open PO commitment vs budget lines keyed by tracking category (null = unclassified). */
export function commitmentVsBudget(input: {
  openPoByCategory: { trackingCategoryId: string | null; total: string }[]
  budgetByCategory: { trackingCategoryId: string | null; amount: string }[]
  categoryNames: Map<string | null, string | null>
}): CommitmentBucket[] {
  const poMap = new Map<string | null, Decimal>()
  for (const row of input.openPoByCategory) {
    poMap.set(row.trackingCategoryId, new Decimal(row.total))
  }
  const budgetMap = new Map<string | null, Decimal>()
  for (const row of input.budgetByCategory) {
    const key = row.trackingCategoryId
    const prev = budgetMap.get(key) ?? ZERO
    budgetMap.set(key, prev.plus(new Decimal(row.amount)))
  }
  const keys = new Set([...poMap.keys(), ...budgetMap.keys()])
  const rows: CommitmentBucket[] = []
  for (const key of keys) {
    const open = poMap.get(key) ?? ZERO
    const budget = budgetMap.get(key) ?? ZERO
    rows.push({
      trackingCategoryId: key,
      trackingCategoryName: input.categoryNames.get(key) ?? (key ? null : 'Unclassified'),
      openPoTotal: open.toFixed(4),
      budgetAmount: budget.toFixed(4),
      remaining: budget.minus(open).toFixed(4),
    })
  }
  return rows.sort((a, b) => (a.trackingCategoryName ?? '').localeCompare(b.trackingCategoryName ?? ''))
}

/** Actual plus open PO commitment exceeds budgeted amount. */
export function grantOverBudget(input: {
  budgeted: string
  actual: string
  encumbered: string
}): boolean {
  const budget = new Decimal(input.budgeted)
  if (budget.lessThanOrEqualTo(0)) return false
  const used = new Decimal(input.actual).plus(input.encumbered)
  return used.greaterThan(budget)
}
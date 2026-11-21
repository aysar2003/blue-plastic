import { Decimal, ZERO } from '@/lib/money'

export type CommitmentBucket = {
  trackingCategoryId: string | null
  trackingCategoryName: string | null
  openPoTotal: string
  actual: string
  budgetAmount: string
  remaining: string
}

/** Remaining = budget − encumbered − actual. */
export function remainingAfterCommitments(input: {
  budget: string | number
  encumbered: string | number
  actual: string | number
}): string {
  return new Decimal(input.budget || 0)
    .minus(input.encumbered || 0)
    .minus(input.actual || 0)
    .toFixed(4)
}

/** Unreceived PO value (encumbrance still outstanding). */
export function outstandingPoAmount(
  lines: { quantity: string | number; quantityReceived: string | number; amount: string | number }[],
): string {
  let open = ZERO
  for (const line of lines) {
    const qty = new Decimal(line.quantity || 0)
    if (qty.lessThanOrEqualTo(0)) continue
    const received = Decimal.min(new Decimal(line.quantityReceived || 0), qty)
    const left = qty.minus(received)
    if (left.lessThanOrEqualTo(0)) continue
    open = open.plus(new Decimal(line.amount || 0).times(left).div(qty))
  }
  return open.toFixed(4)
}

export function poStillEncumbered(status: string): boolean {
  return status === 'OPEN' || status === 'PARTIAL' || status === 'PENDING_APPROVAL'
}

/** Open PO commitment vs budget lines keyed by tracking category (null = unclassified). */
export function commitmentVsBudget(input: {
  openPoByCategory: { trackingCategoryId: string | null; total: string }[]
  budgetByCategory: { trackingCategoryId: string | null; amount: string }[]
  actualByCategory?: { trackingCategoryId: string | null; total: string }[]
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
  const actualMap = new Map<string | null, Decimal>()
  for (const row of input.actualByCategory ?? []) {
    const prev = actualMap.get(row.trackingCategoryId) ?? ZERO
    actualMap.set(row.trackingCategoryId, prev.plus(new Decimal(row.total)))
  }
  const keys = new Set([...poMap.keys(), ...budgetMap.keys(), ...actualMap.keys()])
  const rows: CommitmentBucket[] = []
  for (const key of keys) {
    const open = poMap.get(key) ?? ZERO
    const budget = budgetMap.get(key) ?? ZERO
    const actual = actualMap.get(key) ?? ZERO
    rows.push({
      trackingCategoryId: key,
      trackingCategoryName: input.categoryNames.get(key) ?? (key ? null : 'Unclassified'),
      openPoTotal: open.toFixed(4),
      actual: actual.toFixed(4),
      budgetAmount: budget.toFixed(4),
      remaining: remainingAfterCommitments({
        budget: budget.toFixed(4),
        encumbered: open.toFixed(4),
        actual: actual.toFixed(4),
      }),
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
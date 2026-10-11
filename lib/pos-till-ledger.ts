import { Decimal, ZERO } from '@/lib/money'

/**
 * Parent balance for display — QuickBooks-style roll-up.
 * Own posted balance plus every descendant. Headings such as POS Banks usually
 * post nothing themselves, so the figure is the sum of the tills underneath.
 */
export function rollupParentBalances<T extends { id: string; parentId: string | null; balance: Decimal }>(
  rows: T[],
): Map<string, Decimal> {
  const children = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.parentId) continue
    const list = children.get(row.parentId) ?? []
    list.push(row.id)
    children.set(row.parentId, list)
  }

  const byId = new Map(rows.map((row) => [row.id, row]))
  const rolled = new Map<string, Decimal>()

  const totalOf = (id: string): Decimal => {
    const hit = rolled.get(id)
    if (hit) return hit
    const row = byId.get(id)
    let total = row?.balance ?? ZERO
    for (const childId of children.get(id) ?? []) {
      total = total.plus(totalOf(childId))
    }
    rolled.set(id, total)
    return total
  }

  for (const row of rows) totalOf(row.id)
  return rolled
}

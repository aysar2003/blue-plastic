/**
 * Pure helpers for the bank feed. No database, so the grouping and the rule
 * match can be checked without a ledger.
 */

export type RuleLike = {
  id: string
  name: string
  contains: string
  accountId: string | null
  categoryAccountId: string
  vendorId: string | null
  customerId: string | null
}

/** The words a person would recognise as "the same payee", ignoring amounts and dates. */
export function groupKey(description: string): string {
  const words = description
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 3)
  return words.join(' ') || description.trim().toLowerCase() || '(blank)'
}

/**
 * Bank-specific rules win over rules that apply to every bank. Within that,
 * name order is stable so two overlapping rules do not flip between imports.
 */
function matchRank(rule: RuleLike, accountId: string): number {
  if (rule.accountId === accountId) return 0
  if (rule.accountId === null) return 1
  return 2
}

/** The first active rule whose text sits inside the bank description. */
export function ruleFor(description: string, accountId: string, rules: RuleLike[]): RuleLike | null {
  const text = description.toLowerCase()
  const ordered = [...rules].sort((a, b) => {
    const byBank = matchRank(a, accountId) - matchRank(b, accountId)
    if (byBank !== 0) return byBank
    return a.name.localeCompare(b.name)
  })
  return (
    ordered.find(
      (rule) =>
        rule.contains.trim().length > 0 &&
        text.includes(rule.contains.trim().toLowerCase()) &&
        (rule.accountId === null || rule.accountId === accountId),
    ) ?? null
  )
}

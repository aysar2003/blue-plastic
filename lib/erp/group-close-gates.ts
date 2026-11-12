/** Pure checklist gates for group close (used by service + tests). */

export type GroupCloseGateInput = {
  openOrMissingCount: number
  unmatchedIcCount: number
  currencyMismatch: boolean
  currencies: string[]
  ownershipIncomplete: boolean
  asOf: string
}

export function buildGroupCloseBlockers(input: GroupCloseGateInput): string[] {
  const blockers: string[] = []
  if (input.openOrMissingCount > 0) {
    blockers.push(
      `${input.openOrMissingCount} compan${input.openOrMissingCount === 1 ? 'y has' : 'ies have'} an open or missing period for ${input.asOf}.`,
    )
  }
  if (input.unmatchedIcCount > 0) {
    blockers.push(
      `${input.unmatchedIcCount} unmatched intercompany journal${input.unmatchedIcCount === 1 ? '' : 's'}.`,
    )
  }
  if (input.currencyMismatch) {
    blockers.push(
      `Group uses multiple currencies (${input.currencies.join(', ')}). Consol is informational only.`,
    )
  }
  if (input.ownershipIncomplete) {
    blockers.push('A sub-company has 0% ownership — set ownership before consolidating.')
  }
  return blockers
}

/** Currency mismatch warns but does not block ready. */
export function isGroupCloseReady(blockers: string[]): boolean {
  return blockers.filter((b) => !b.includes('multiple currencies')).length === 0
}

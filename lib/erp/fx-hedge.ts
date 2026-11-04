/**
 * IFRS 9 / IAS 39 cash-flow and fair-value hedge *documentation* for SME books.
 * Not a dealing desk, not ISDA, not speculative forwards trading.
 */

export const FX_HEDGE_KINDS = ['CASH_FLOW', 'FAIR_VALUE'] as const
export type FxHedgeKind = (typeof FX_HEDGE_KINDS)[number]

export const FX_HEDGE_STATUSES = ['OPEN', 'SETTLED', 'CANCELLED'] as const
export type FxHedgeStatus = (typeof FX_HEDGE_STATUSES)[number]

export const FX_HEDGE_LEGAL =
  'Accounting hedge on this company’s books using the company FX rate. Not a trading venue and not a qualified derivative contract.'

export function isFxHedgeKind(value: string): value is FxHedgeKind {
  return (FX_HEDGE_KINDS as readonly string[]).includes(value)
}

export function hedgeDocumented(input: {
  risk: string
  hedgedItem: string
  instrument: string
  kind: string
}): boolean {
  return (
    input.risk.trim().length > 3 &&
    input.hedgedItem.trim().length > 3 &&
    input.instrument.trim().length > 3 &&
    isFxHedgeKind(input.kind)
  )
}

/** Dollar-offset 80–125% (IAS 39 highly-effective band). */
export function hedgeEffective(changeInInstrument: number, changeInHedgedItem: number): boolean {
  if (changeInHedgedItem === 0) return changeInInstrument === 0
  const ratio = Math.abs(changeInInstrument / changeInHedgedItem)
  return ratio >= 0.8 && ratio <= 1.25
}

/** Base-currency MTM: notional × (spot − contract). */
export function markToMarket(notional: string, contractRate: string, spotRate: string): string {
  const n = Number(notional)
  const contract = Number(contractRate)
  const spot = Number(spotRate)
  if (!Number.isFinite(n) || !Number.isFinite(contract) || !Number.isFinite(spot)) return '0.0000'
  return (n * (spot - contract)).toFixed(4)
}

export function canSettleHedge(status: string): boolean {
  return status === 'OPEN'
}

export function canCancelHedge(status: string): boolean {
  return status === 'OPEN'
}

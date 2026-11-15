import { Decimal, ZERO } from '@/lib/money'

/** Royalty = child sales × royalty % / 100. */
export function franchiseRoyaltyAmount(salesTotal: Decimal.Value, royaltyPercent: Decimal.Value | null): Decimal {
  if (royaltyPercent == null) return ZERO
  const pct = new Decimal(royaltyPercent)
  if (pct.lessThanOrEqualTo(0)) return ZERO
  return new Decimal(salesTotal).times(pct).div(100).toDecimalPlaces(4)
}
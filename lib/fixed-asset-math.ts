import { Decimal, ZERO } from '@/lib/money'

/** Straight-line monthly amount (cost − salvage) / life months. */
export function monthlyDepreciation(cost: Decimal, salvage: Decimal, lifeMonths: number): Decimal {
  if (lifeMonths < 1) return ZERO
  const depreciable = cost.minus(salvage)
  if (depreciable.lessThanOrEqualTo(0)) return ZERO
  return depreciable.dividedBy(lifeMonths).toDecimalPlaces(4)
}

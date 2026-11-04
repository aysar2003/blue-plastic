import { Decimal, ZERO } from '@/lib/money'

/** Straight-line monthly depreciation (same basis as the fixed-asset service). */
export function monthlyDepreciationAmount(
  cost: string | Decimal,
  salvage: string | Decimal,
  usefulLifeMonths: number,
): Decimal {
  if (usefulLifeMonths <= 0) return ZERO
  const base = new Decimal(cost).minus(salvage)
  if (base.lessThanOrEqualTo(0)) return ZERO
  return base.div(usefulLifeMonths).toDecimalPlaces(4)
}

/** Remaining depreciable base after accumulated depreciation. */
export function remainingDepreciable(
  cost: string | Decimal,
  salvage: string | Decimal,
  accumulated: string | Decimal,
): Decimal {
  const cap = new Decimal(cost).minus(salvage)
  const left = cap.minus(accumulated)
  return left.lessThan(ZERO) ? ZERO : left
}

/** Amount to post this month — capped at what is left to depreciate. */
export function depreciationForMonth(
  cost: string | Decimal,
  salvage: string | Decimal,
  usefulLifeMonths: number,
  accumulated: string | Decimal,
): Decimal {
  const monthly = monthlyDepreciationAmount(cost, salvage, usefulLifeMonths)
  const left = remainingDepreciable(cost, salvage, accumulated)
  return monthly.lessThan(left) ? monthly : left
}

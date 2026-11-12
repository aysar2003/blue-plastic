import { Decimal, ZERO } from '@/lib/money'

/** Monthly recognition slice; last month gets the remainder so totals match. */
export function recognitionSlice(
  totalAmount: Decimal.Value,
  serviceMonths: number,
  monthIndex: number,
  alreadyRecognized: Decimal.Value,
): Decimal {
  const months = Math.max(1, Math.floor(serviceMonths))
  const total = new Decimal(totalAmount)
  const recognized = new Decimal(alreadyRecognized)
  const remaining = Decimal.max(total.minus(recognized), ZERO)
  if (remaining.isZero()) return ZERO

  if (monthIndex >= months - 1) {
    return remaining.toDecimalPlaces(4)
  }

  const even = total.div(months).toDecimalPlaces(4)
  return Decimal.min(even, remaining).toDecimalPlaces(4)
}

export function remainingUnearned(
  totalAmount: Decimal.Value,
  recognizedAmount: Decimal.Value,
): Decimal {
  return Decimal.max(new Decimal(totalAmount).minus(recognizedAmount), ZERO).toDecimalPlaces(4)
}

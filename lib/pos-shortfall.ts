/**
 * Till rounding: an unpaid remainder of at most ten cents may be waived as a
 * sales discount on the receipt. Anything larger must be collected — the sale
 * does not go through.
 */
export const POS_SHORTFALL_DISCOUNT_MAX = 0.1

export type ShortfallResult =
  | { status: 'exact' }
  | { status: 'discount'; amount: number }
  | { status: 'short'; amount: number }
  | { status: 'over'; amount: number }

/** Compare what was paid to the cart total. Amounts are in major units. */
export function settlePaymentShortfall(total: number, paid: number): ShortfallResult {
  const gap = Math.round((total - paid) * 100) / 100
  if (Math.abs(gap) <= 0.009) return { status: 'exact' }
  if (gap > 0) {
    if (gap <= POS_SHORTFALL_DISCOUNT_MAX + 0.009) {
      return { status: 'discount', amount: gap }
    }
    return { status: 'short', amount: gap }
  }
  return { status: 'over', amount: Math.abs(gap) }
}

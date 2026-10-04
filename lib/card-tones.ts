/**
 * Colours for cards by what they mean — so a stock figure, a money total, and
 * a warning never look the same. Used as `tone` on Card / MetricCard.
 */
export const CARD_TONES = [
  'neutral',
  'stock',
  'zero',
  'danger',
  'warning',
  'money',
  'ledger',
  'success',
  'info',
  'sales',
  'purchase',
] as const

export type CardTone = (typeof CARD_TONES)[number]

export function isCardTone(value: string): value is CardTone {
  return (CARD_TONES as readonly string[]).includes(value)
}

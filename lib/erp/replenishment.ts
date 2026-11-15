import { Decimal, ZERO } from '@/lib/money'

/** Suggested transfer qty when on hand is at or below reorder. */
export function suggestedReplenishmentQty(
  reorderPoint: string | Decimal | null | undefined,
  onHand: string | Decimal,
): string {
  const reorder = reorderPoint != null ? new Decimal(reorderPoint.toString()) : null
  if (!reorder || reorder.lessThanOrEqualTo(0)) return '0.0000'
  const qty = new Decimal(onHand.toString())
  if (qty.greaterThan(reorder)) return '0.0000'
  const need = reorder.minus(qty)
  return Decimal.max(need, ZERO).toFixed(4)
}

/** Never suggest moving more than the source store can spare. */
export function capReplenishmentBySource(
  suggestedQty: string | Decimal,
  sourceOnHand: string | Decimal | null | undefined,
): string {
  const need = new Decimal(suggestedQty.toString())
  if (need.lessThanOrEqualTo(0)) return '0.0000'
  if (sourceOnHand == null) return need.toFixed(4)
  const available = new Decimal(sourceOnHand.toString())
  if (available.lessThanOrEqualTo(0)) return '0.0000'
  return Decimal.min(need, available).toFixed(4)
}

export function belowReorder(
  reorderPoint: string | Decimal | null | undefined,
  onHand: string | Decimal,
): boolean {
  const reorder = reorderPoint != null ? new Decimal(reorderPoint.toString()) : null
  if (!reorder) return false
  return new Decimal(onHand.toString()).lessThanOrEqualTo(reorder)
}
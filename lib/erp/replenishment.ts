import { Decimal, ZERO } from '@/lib/money'

/** Min trigger: store min, else item reorder point. */
export function replenishMinQty(
  storeMin: string | Decimal | null | undefined,
  itemReorder: string | Decimal | null | undefined,
): Decimal | null {
  if (storeMin != null && storeMin !== '') {
    const min = new Decimal(storeMin.toString())
    if (min.greaterThan(0)) return min
  }
  if (itemReorder != null && itemReorder !== '') {
    const reorder = new Decimal(itemReorder.toString())
    if (reorder.greaterThan(0)) return reorder
  }
  return null
}

/** Target on-hand after replenish: store max, else item max, else the min trigger. */
export function replenishMaxQty(
  storeMax: string | Decimal | null | undefined,
  itemMax: string | Decimal | null | undefined,
  min: Decimal | null,
): Decimal | null {
  if (storeMax != null && storeMax !== '') {
    const max = new Decimal(storeMax.toString())
    if (max.greaterThan(0)) return max
  }
  if (itemMax != null && itemMax !== '') {
    const max = new Decimal(itemMax.toString())
    if (max.greaterThan(0)) return max
  }
  return min
}

/** Suggested transfer qty when on hand is at or below reorder / min. Fills to max when set. */
export function suggestedReplenishmentQty(
  reorderPoint: string | Decimal | null | undefined,
  onHand: string | Decimal,
  options?: {
    storeMin?: string | Decimal | null
    storeMax?: string | Decimal | null
    itemMax?: string | Decimal | null
  },
): string {
  const min = replenishMinQty(options?.storeMin, reorderPoint)
  if (!min) return '0.0000'
  const qty = new Decimal(onHand.toString())
  if (qty.greaterThan(min)) return '0.0000'
  const target = replenishMaxQty(options?.storeMax, options?.itemMax, min) ?? min
  const need = Decimal.max(target.minus(qty), ZERO)
  return need.toFixed(4)
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
  return belowReplenishTrigger(onHand, { itemReorder: reorderPoint })
}

export function belowReplenishTrigger(
  onHand: string | Decimal,
  options: {
    storeMin?: string | Decimal | null
    itemReorder?: string | Decimal | null
  },
): boolean {
  const min = replenishMinQty(options.storeMin, options.itemReorder)
  if (!min) return false
  return new Decimal(onHand.toString()).lessThanOrEqualTo(min)
}
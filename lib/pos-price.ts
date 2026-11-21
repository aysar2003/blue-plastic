/**
 * Till unit price for a product given the walk-in customer's price level.
 * Named list (when the list date window is active) beats wholesale/retail,
 * then an active % promotion is applied.
 */
export function posUnitPrice(
  product: { price: string; wholesalePrice?: string | null; promoPercent?: number | null },
  priceLevel: 'RETAIL' | 'WHOLESALE' | null | undefined,
  listPrice?: string | null,
): string {
  let base: number | null = null
  if (listPrice != null && listPrice !== '') {
    const listed = Number(listPrice)
    if (Number.isFinite(listed) && listed >= 0) base = listed
  }
  if (base == null && priceLevel === 'WHOLESALE' && product.wholesalePrice != null && product.wholesalePrice !== '') {
    const wholesale = Number(product.wholesalePrice)
    if (Number.isFinite(wholesale) && wholesale >= 0) base = wholesale
  }
  if (base == null) {
    const retail = Number(product.price)
    base = Number.isFinite(retail) && retail >= 0 ? retail : 0
  }
  const pct = Number(product.promoPercent ?? 0)
  if (Number.isFinite(pct) && pct > 0) {
    base = base * (1 - Math.min(pct, 100) / 100)
  }
  return base.toFixed(2)
}

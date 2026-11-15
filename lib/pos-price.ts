/**
 * Till unit price for a product given the walk-in customer's price level.
 * Wholesale uses the item wholesale price when set; otherwise the sales price.
 */
export function posUnitPrice(
  product: { price: string; wholesalePrice?: string | null },
  priceLevel: 'RETAIL' | 'WHOLESALE' | null | undefined,
): string {
  if (priceLevel === 'WHOLESALE' && product.wholesalePrice != null && product.wholesalePrice !== '') {
    const wholesale = Number(product.wholesalePrice)
    if (Number.isFinite(wholesale) && wholesale >= 0) return wholesale.toFixed(2)
  }
  const retail = Number(product.price)
  return Number.isFinite(retail) && retail >= 0 ? retail.toFixed(2) : '0.00'
}

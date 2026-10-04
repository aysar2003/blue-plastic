/** A product the bell should mention. `out` is empty; `limit` has reached the reorder point. */
export type StockAlert = {
  itemId: string
  name: string
  quantity: string
  reorderPoint: string | null
  kind: 'out' | 'limit'
}

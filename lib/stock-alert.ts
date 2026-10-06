/** A product the bell should mention. `out` is empty; `limit` has reached the reorder point. */
export type StockAlert = {
  itemId: string
  name: string
  quantity: string
  reorderPoint: string | null
  kind: 'out' | 'limit'
}

/**
 * What the bell receives: at most a few hundred rows to list, plus the true number
 * of products that need attention, so the count and "N more" stay honest.
 */
export type StockAlertSummary = {
  alerts: StockAlert[]
  total: number
}

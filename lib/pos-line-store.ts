/**
 * Which store a POS line takes its goods from.
 *
 * The counter (register) sells from its own store — the register's store, or
 * the office when the register says "Office default". A line comes from
 * another store when the cashier picks one, or automatically when the
 * counter's store can't cover the quantity and another store can (the store
 * holding the most wins). If no store can cover it, the line stays on the
 * counter's store and the usual negative-stock warning applies.
 *
 * Goods from the counter's own store are handed over at the till; goods from
 * any other store get a pick ticket for that store, linked to the receipt.
 */
export function chooseLineStore(input: {
  /** Store the cashier picked for this line, if any. */
  requested?: string | null
  /** The counter's store (register store, else office). Null only when no store exists. */
  counterStoreId: string | null
  /** Tracked items only; services / non-stock lines just take the counter store. */
  tracked: boolean
  quantity: number
  /** store id → on hand for this item. */
  onHandByStore: Record<string, string | number>
  /** Active stores the line may come from. */
  activeStoreIds: string[]
}): string | null {
  const { requested, counterStoreId, tracked, quantity, onHandByStore, activeStoreIds } = input
  if (requested && activeStoreIds.includes(requested)) return requested
  if (!tracked) return counterStoreId

  const onHand = (storeId: string) => {
    const value = Number(onHandByStore[storeId] ?? 0)
    return Number.isFinite(value) ? value : 0
  }
  if (counterStoreId && onHand(counterStoreId) >= quantity) return counterStoreId

  let best: { id: string; qty: number } | null = null
  for (const storeId of activeStoreIds) {
    if (storeId === counterStoreId) continue
    const qty = onHand(storeId)
    if (qty < quantity) continue
    if (!best || qty > best.qty) best = { id: storeId, qty }
  }
  return best?.id ?? counterStoreId
}

/** A sale line needs a store pick ticket when its goods leave a store other than the counter's. */
export function needsPickTicket(lineStoreId: string | null, counterStoreId: string | null | undefined) {
  if (!lineStoreId) return false
  // Not a POS sale (no counter): every stocked line gets a ticket, as before.
  if (counterStoreId === undefined) return true
  return lineStoreId !== counterStoreId
}

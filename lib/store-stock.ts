import { Decimal, ZERO } from '@/lib/money'

export type StoreChoice = {
  id: string
  name: string
  isOffice: boolean
}

/** item id → store id → quantity, already rounded for display. */
export type StockByStore = Record<string, Record<string, string>>

export function officeStoreId(stores: StoreChoice[]): string {
  return stores.find((store) => store.isOffice)?.id ?? stores[0]?.id ?? ''
}

/**
 * Movements recorded before a store was chosen have no store. They are counted
 * at the office, so the store columns still add up to on hand.
 */
export function foldStoreQuantities(
  rows: { itemId: string; storeId: string | null; quantity: string }[],
  officeId: string,
): StockByStore {
  const totals = new Map<string, Map<string, Decimal>>()
  for (const row of rows) {
    const storeId = row.storeId ?? officeId
    if (!storeId) continue
    const byStore = totals.get(row.itemId) ?? new Map<string, Decimal>()
    byStore.set(storeId, (byStore.get(storeId) ?? ZERO).plus(row.quantity))
    totals.set(row.itemId, byStore)
  }

  const byItem: StockByStore = {}
  for (const [itemId, byStore] of totals) {
    const bucket: Record<string, string> = {}
    for (const [storeId, quantity] of byStore) bucket[storeId] = quantity.toFixed(2)
    byItem[itemId] = bucket
  }
  return byItem
}

/**
 * When the chosen store does not hold enough and another store does, name it so
 * the line can be moved. The negative-stock warning on the item line covers the
 * rest (selling below zero is allowed; a later bill corrects it).
 */
export function shortStockNote(
  stores: StoreChoice[],
  stock: StockByStore,
  itemId: string,
  storeId: string,
  quantity: string,
): string | null {
  if (!itemId || !storeId) return null
  const need = Number(quantity)
  if (!Number.isFinite(need) || need <= 0) return null
  const places = stock[itemId] ?? {}
  const have = Number(places[storeId] ?? '0')
  if (have >= need) return null
  const others = stores
    .filter((store) => store.id !== storeId && Number(places[store.id] ?? '0') > 0)
    .map((store) => `${store.name} (${formatStockQty(Number(places[store.id]))})`)
  if (others.length === 0) return null
  return `Also in ${others.join(', ')}.`
}

/** Stock left in a store after this sale, when that is below zero. */
export type StockWarning = {
  storeName: string
  /** On hand in that store before this sale. */
  onHand: number
  /** On hand after this sale (this line plus earlier lines for the same item and store). */
  after: number
}

/**
 * Only when this sale leaves the store below zero; null while on hand covers it.
 * Never blocks: negative stock is allowed and a later bill fixes it.
 */
export function negativeStockWarning(onHand: number, selling: number, storeName: string): StockWarning | null {
  if (!Number.isFinite(onHand)) return null
  const qty = Number.isFinite(selling) && selling > 0 ? selling : 0
  const after = onHand - qty
  if (after >= 0) return null
  return { storeName, onHand, after }
}

/** 12 → "12", 2.5 → "2.50", -3 → "−3" (true minus sign). */
export function formatStockQty(value: number): string {
  const text = Math.abs(value).toFixed(value % 1 === 0 ? 0 : 2)
  return value < 0 ? `\u2212${text}` : text
}

/** Hover / screen-reader text for the bare number, e.g. "Xafiiska after this sale: −9 (on hand −7)". */
export function stockWarningTitle(warning: StockWarning): string {
  const where = warning.storeName ? `${warning.storeName} after this sale` : 'After this sale'
  return `${where}: ${formatStockQty(warning.after)} (on hand ${formatStockQty(warning.onHand)})`
}

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

/** What the person entering a sale should know before stock goes below zero. */
export type StockWarning = {
  storeName: string
  /** On hand in that store before this sale. */
  onHand: number
  /** On hand after this sale (this line plus earlier lines for the same item and store). */
  after: number
}

/**
 * Warn when the store is already at or below zero, or when this sale takes it
 * below zero. Never blocks: negative stock is allowed and a later bill fixes it.
 */
export function negativeStockWarning(onHand: number, selling: number, storeName: string): StockWarning | null {
  if (!Number.isFinite(onHand)) return null
  const qty = Number.isFinite(selling) && selling > 0 ? selling : 0
  const after = onHand - qty
  if (onHand > 0 && after >= 0) return null
  return { storeName, onHand, after }
}

/** 12 → "12", 2.5 → "2.50", -3 → "−3" (true minus sign). */
export function formatStockQty(value: number): string {
  const text = Math.abs(value).toFixed(value % 1 === 0 ? 0 : 2)
  return value < 0 ? `\u2212${text}` : text
}

/** "Stock: 0 at Xafiiska → −2 after this sale. Will go negative." */
export function stockWarningText(warning: StockWarning): string {
  const head = `Stock: ${formatStockQty(warning.onHand)}${warning.storeName ? ` at ${warning.storeName}` : ''}`
  const tail = warning.onHand < 0 ? 'Already below zero.' : 'Will go negative.'
  if (warning.after === warning.onHand) return `${head}. ${tail}`
  return `${head} \u2192 ${formatStockQty(warning.after)} after this sale. ${tail}`
}

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
 * When the chosen store does not hold enough, say so, and name any store that does.
 * A store is allowed to go below zero; a later bill fills it.
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
  const name = stores.find((store) => store.id === storeId)?.name ?? 'This store'
  const others = stores
    .filter((store) => store.id !== storeId && Number(places[store.id] ?? '0') > 0)
    .map((store) => `${store.name} has ${places[store.id]}`)
  if (others.length === 0) {
    return `${name} has ${have.toFixed(2)}. This store can go below zero. A later bill fills it.`
  }
  return `${name} has ${have.toFixed(2)}. ${others.join('. ')}.`
}

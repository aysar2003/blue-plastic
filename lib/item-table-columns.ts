export const ITEM_TABLE_STORAGE_KEY = 'bp-item-table-columns-v1'

export const ITEM_FIXED_COLUMN_IDS = [
  'name',
  'sku',
  'category',
  'salesDescription',
  'type',
  'incomeAccount',
  'inventoryAccount',
  'cogsExpense',
  'store',
  'onHand',
  'price',
  'stockValue',
  'cost',
  'purchaseDescription',
  'reorderPoint',
  'unitOfMeasure',
] as const

export type ItemFixedColumnId = (typeof ITEM_FIXED_COLUMN_IDS)[number]
export type ItemColumnId = ItemFixedColumnId | `store:${string}`

export type ItemColumnDef = {
  id: ItemColumnId
  label: string
}

export const ITEM_COLUMN_LABELS: Record<ItemFixedColumnId, string> = {
  name: 'Item',
  sku: 'SKU',
  category: 'Category',
  salesDescription: 'Sales description',
  type: 'Type',
  incomeAccount: 'Income account',
  inventoryAccount: 'Inventory account',
  cogsExpense: 'COGS or expense',
  store: 'Store',
  onHand: 'On hand',
  price: 'Price',
  stockValue: 'Stock value',
  cost: 'Cost',
  purchaseDescription: 'Purchase description',
  reorderPoint: 'Reorder point',
  unitOfMeasure: 'Unit of measure',
}

/** Every column is on when the list opens. A person can still hide one. */
export const ITEM_DEFAULT_HIDDEN: ItemFixedColumnId[] = []

/**
 * These stay on the first row. The rest of the catalogue (accounts, each
 * store, descriptions) is drawn in the band under the row.
 */
export const ITEM_MAIN_COLUMN_IDS: ItemFixedColumnId[] = [
  'name',
  'type',
  'onHand',
  'price',
  'stockValue',
  'cost',
]

export function storeColumnId(storeId: string): ItemColumnId {
  return `store:${storeId}`
}

export function isStoreColumnId(id: ItemColumnId): id is `store:${string}` {
  return id.startsWith('store:')
}

/** Table order: core columns, per-store qty, amounts, then optional fields. */
export function buildItemTableColumns(stores: { id: string; name: string }[]): ItemColumnDef[] {
  const core: ItemFixedColumnId[] = [
    'name',
    'type',
    'incomeAccount',
    'inventoryAccount',
    'cogsExpense',
    'store',
    'onHand',
  ]
  const afterStores: ItemFixedColumnId[] = ['price', 'stockValue', 'cost']
  const optional: ItemFixedColumnId[] = [
    'sku',
    'category',
    'salesDescription',
    'purchaseDescription',
    'reorderPoint',
    'unitOfMeasure',
  ]

  const fixed = (ids: ItemFixedColumnId[]) =>
    ids.map((id) => ({ id, label: ITEM_COLUMN_LABELS[id] }))

  const storeCols = stores.map((s) => ({ id: storeColumnId(s.id), label: s.name }))

  return [...fixed(core), ...storeCols, ...fixed(afterStores), ...fixed(optional)]
}

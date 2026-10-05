import { pick, type CsvRow, type ImportIssue } from '@/lib/csv'

/**
 * Stock-count worksheet columns — export from Adjust stock, edit offline,
 * import back. Only rows with a filled "Count found" are applied; everything
 * else is left alone (Odoo-style round trip).
 */
export const STOCK_COUNT_HEADERS = [
  'Item ID',
  'SKU',
  'Name',
  'Books say',
  'Count found',
  'Note',
] as const

export type StockCountImportLine = {
  itemId: string
  label: string
  counted: string
  description: string
  booksSay: string
}

export type StockCountCatalogItem = {
  id: string
  label: string
  sku?: string | null
  onHand: string
}

function loose(value: string) {
  return value.trim().toLowerCase()
}

/**
 * Match an import row to a catalogue item: Item ID first, then SKU, then name.
 */
export function matchStockCountRow(
  row: CsvRow,
  byId: Map<string, StockCountCatalogItem>,
  bySku: Map<string, StockCountCatalogItem>,
  byName: Map<string, StockCountCatalogItem>,
): StockCountCatalogItem | null {
  const id = pick(row, 'Item ID', 'item id', 'itemid', 'id')
  if (id && byId.has(id)) return byId.get(id) ?? null

  const sku = pick(row, 'SKU', 'sku', 'Barcode')
  if (sku) {
    const hit = bySku.get(loose(sku))
    if (hit) return hit
  }

  const name = pick(row, 'Name', 'Product/Service Name', 'Item', 'Product')
  if (name) {
    const hit = byName.get(loose(name))
    if (hit) return hit
  }

  return null
}

/**
 * Turn spreadsheet rows into adjustment lines.
 *
 * Blank "Count found" = leave that item alone.
 * Count equal to books = skip (no change to post).
 */
export function parseStockCountRows(
  rows: CsvRow[],
  catalog: StockCountCatalogItem[],
): { lines: StockCountImportLine[]; issues: ImportIssue[]; skipped: number } {
  const byId = new Map(catalog.map((item) => [item.id, item]))
  const bySku = new Map<string, StockCountCatalogItem>()
  const byName = new Map<string, StockCountCatalogItem>()
  for (const item of catalog) {
    byName.set(loose(item.label), item)
    const skuPart = item.sku?.trim()
    if (skuPart) bySku.set(loose(skuPart), item)
    // Label may be "SKU — Name"
    const dash = item.label.indexOf(' — ')
    if (dash > 0) {
      bySku.set(loose(item.label.slice(0, dash)), item)
      byName.set(loose(item.label.slice(dash + 3)), item)
    }
  }

  const lines: StockCountImportLine[] = []
  const issues: ImportIssue[] = []
  const seen = new Set<string>()
  let skipped = 0

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const counted = pick(row, 'Count found', 'Counted', 'Count', 'Qty found', 'Quantity found', 'New quantity')
    if (!counted) {
      skipped += 1
      return
    }
    if (!/^-?\d+(\.\d+)?$/.test(counted.replace(/,/g, ''))) {
      issues.push({ row: rowNumber, field: 'Count found', message: 'Enter a number for the count found.' })
      return
    }
    const quantity = counted.replace(/,/g, '')

    const item = matchStockCountRow(row, byId, bySku, byName)
    if (!item) {
      issues.push({
        row: rowNumber,
        field: 'Item',
        message: 'No matching product. Keep Item ID or SKU from the export.',
      })
      return
    }
    if (seen.has(item.id)) {
      issues.push({ row: rowNumber, field: 'Item', message: 'This product appears twice. Keep one row.' })
      return
    }
    seen.add(item.id)

    if (Number(quantity) === Number(item.onHand)) {
      skipped += 1
      return
    }

    lines.push({
      itemId: item.id,
      label: item.label,
      counted: quantity,
      description: pick(row, 'Note', 'Notes', 'Description', 'Memo'),
      booksSay: item.onHand,
    })
  })

  return { lines, issues, skipped }
}

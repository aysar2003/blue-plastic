/**
 * Pure barcode-desk catalogue helpers — counts and filters used by the board
 * and the barcode service overview (kept free of DB so tests can cover them).
 */

export type BarcodeCatalogRow = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  type: string
  isActive: boolean
}

export type BarcodeDeskFilter = 'all' | 'with' | 'without'

export type BarcodeCatalogSummary = {
  total: number
  activeTotal: number
  withBarcode: number
  withoutBarcode: number
  inactiveMissing: number
  missing: BarcodeCatalogRow[]
  labelled: BarcodeCatalogRow[]
  all: BarcodeCatalogRow[]
}

export function summarizeBarcodeCatalog(rows: BarcodeCatalogRow[]): BarcodeCatalogSummary {
  const labelled = rows.filter((row) => Boolean(row.barcode))
  const missing = rows.filter((row) => !row.barcode && row.isActive)
  const inactiveMissing = rows.filter((row) => !row.barcode && !row.isActive)
  const activeTotal = rows.filter((row) => row.isActive).length

  return {
    total: rows.length,
    activeTotal,
    withBarcode: labelled.length,
    withoutBarcode: missing.length,
    inactiveMissing: inactiveMissing.length,
    missing,
    labelled,
    all: rows,
  }
}

/** Rows the desk table should show for a summary-card selection. */
export function filterBarcodeCatalog(
  rows: BarcodeCatalogRow[],
  filter: BarcodeDeskFilter,
  query = '',
): BarcodeCatalogRow[] {
  const q = query.trim().toLowerCase()
  const scoped =
    filter === 'with'
      ? rows.filter((row) => Boolean(row.barcode))
      : filter === 'without'
        ? rows.filter((row) => !row.barcode && row.isActive)
        : rows

  if (!q) return scoped

  return scoped.filter(
    (row) =>
      row.name.toLowerCase().includes(q) ||
      (row.sku?.toLowerCase().includes(q) ?? false) ||
      (row.barcode?.toLowerCase().includes(q) ?? false),
  )
}

/**
 * Quantity + unit of measure for display across forms, stock, POS, and paper.
 * Item.unitOfMeasure is free text; blank falls back to Pcs.
 */

export const DEFAULT_UNIT = 'Pcs'

/** Trim trailing zeros on a quantity string or number. */
export function trimQty(value: string | number | null | undefined): string {
  if (value == null || value === '') return ''
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value).trim()
  if (Number.isInteger(n)) return String(n)
  return String(n)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
}

/** Unit label for an item — blank → Pcs. */
export function resolveUnit(unit: string | null | undefined): string {
  const text = unit?.trim()
  return text || DEFAULT_UNIT
}

/**
 * "12 m", "3 Pcs". Pass `unit` from the item; omit or null for Pcs.
 * Empty quantity returns "".
 */
export function formatQty(
  quantity: string | number | null | undefined,
  unit?: string | null,
): string {
  const qty = trimQty(quantity)
  if (!qty) return ''
  return `${qty} ${resolveUnit(unit)}`
}

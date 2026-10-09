import { Decimal } from '@/lib/money'

export type SortDirection = 'asc' | 'desc'

export type GridSort = { id: string; dir: SortDirection }

export type GridLayout = {
  order: string[]
  hidden: string[]
  widths: Record<string, number>
}

const NUMERIC = /^-?\d+(\.\d+)?$/

export function isNumericValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && NUMERIC.test(value)
}

/** First click on an amount sorts high to low. A second click flips direction. */
export function nextSort(current: GridSort | null, id: string, numeric: boolean): GridSort {
  if (!current || current.id !== id) return { id, dir: numeric ? 'desc' : 'asc' }
  return { id, dir: current.dir === 'asc' ? 'desc' : 'asc' }
}

/**
 * Empty cells stay at the bottom in either direction, so a column of blanks
 * does not jump above the rows that actually have a value.
 */
export function compareSortValues(
  a: string | null | undefined,
  b: string | null | undefined,
  dir: SortDirection,
  numeric: boolean,
): number {
  const emptyA = a == null || a === ''
  const emptyB = b == null || b === ''
  if (emptyA && emptyB) return 0
  if (emptyA) return 1
  if (emptyB) return -1
  const sign = dir === 'asc' ? 1 : -1
  if (numeric && isNumericValue(a) && isNumericValue(b)) {
    const delta = Number(a) - Number(b)
    return sign * (delta < 0 ? -1 : delta > 0 ? 1 : 0)
  }
  return sign * a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export function moveItem(order: string[], fromId: string, toId: string): string[] {
  if (fromId === toId) return order
  const next = [...order]
  const from = next.indexOf(fromId)
  const to = next.indexOf(toId)
  if (from < 0 || to < 0) return order
  next.splice(from, 1)
  next.splice(to, 0, fromId)
  return next
}

export function sumAmounts(values: (string | null | undefined)[]): string {
  let total = new Decimal(0)
  for (const value of values) {
    if (!isNumericValue(value)) continue
    total = total.plus(value)
  }
  return total.toString()
}

export function defaultColumnWidth(kind: string | undefined): number {
  if (kind === 'datetime') return 188
  if (kind === 'date') return 128
  if (kind === 'money' || kind === 'number' || kind === 'signed') return 128
  return 160
}

export function mergeGridLayout(
  saved: Partial<GridLayout> | null,
  ids: string[],
  defaultHidden: string[] = [],
  defaultWidths: Record<string, number> = {},
): GridLayout {
  const valid = new Set(ids)
  const savedOrder = Array.isArray(saved?.order) ? saved.order.filter((id) => valid.has(id)) : []
  const order = [...savedOrder, ...ids.filter((id) => !savedOrder.includes(id))]
  const hidden = Array.isArray(saved?.hidden)
    ? saved.hidden.filter((id) => valid.has(id))
    : defaultHidden.filter((id) => valid.has(id))
  const widths: Record<string, number> = {}
  for (const id of ids) {
    const stored = saved?.widths?.[id]
    widths[id] = typeof stored === 'number' && stored >= 72 ? stored : (defaultWidths[id] ?? 160)
  }
  return { order, hidden, widths }
}

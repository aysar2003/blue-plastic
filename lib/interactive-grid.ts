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

/** A laptop page, after the shell's padding, is about this wide. */
const PAGE_WIDTH = 1180

/**
 * The narrowest a column can be and still be read. Amounts must stay on one
 * line (`$1,234.56`); names and notes can wrap.
 */
export function columnMinWidth(kind: string | undefined): number {
  if (kind === 'money' || kind === 'number' || kind === 'signed') return 112
  if (kind === 'datetime') return 136
  if (kind === 'date') return 104
  return 80
}

/** Other accounts on the same entry. They sit under the row, not off to the right. */
export function isOverflowColumn(id: string): boolean {
  return id.startsWith('split:')
}

/**
 * Columns that fit across a laptop stay on the first row. Split accounts, and
 * any other column that would crush the figures, move to the band underneath.
 * Both groups stay visible — nothing starts hidden, and nothing needs a
 * horizontal scrollbar.
 */
export function columnsForViewport<T extends { id: string; kind?: string }>(
  columns: T[],
  preferred: Record<string, number>,
  containerWidth = PAGE_WIDTH,
): { main: T[]; extra: T[] } {
  const width = containerWidth > 0 ? containerWidth : PAGE_WIDTH
  const extraIds = new Set<string>()
  const main: T[] = []
  for (const column of columns) {
    if (isOverflowColumn(column.id)) extraIds.add(column.id)
    else main.push(column)
  }

  const pinned = (column: T, index: number) =>
    index === 0 ||
    column.kind === 'money' ||
    column.kind === 'number' ||
    column.kind === 'signed' ||
    column.kind === 'date' ||
    column.kind === 'datetime'

  const minSum = (list: T[]) => list.reduce((sum, column) => sum + columnMinWidth(column.kind), 0)

  while (main.length > 1 && minSum(main) > width) {
    let dropAt = -1
    let widest = -1
    for (let index = 0; index < main.length; index += 1) {
      const column = main[index]
      if (!column || pinned(column, index)) continue
      const size = preferred[column.id] ?? defaultColumnWidth(column.kind)
      if (size > widest) {
        widest = size
        dropAt = index
      }
    }
    if (dropAt < 0) break
    const dropped = main.splice(dropAt, 1)[0]
    if (dropped) extraIds.add(dropped.id)
  }

  const mainIds = new Set(main.map((column) => column.id))
  return {
    main: columns.filter((column) => mainIds.has(column.id)),
    extra: columns.filter((column) => extraIds.has(column.id)),
  }
}

/**
 * Relative widths that add up to the page. A figure column is widened until
 * it keeps its readable minimum on a laptop; the remaining columns share
 * what's left, in proportion to the width the grid remembered.
 */
export function columnShareWeights(
  columns: { id: string; kind?: string }[],
  preferred: Record<string, number>,
  pageWidth = PAGE_WIDTH,
): number[] {
  const weights = columns.map((column) =>
    Math.max(columnMinWidth(column.kind), preferred[column.id] ?? defaultColumnWidth(column.kind)),
  )
  for (let pass = 0; pass < columns.length; pass += 1) {
    const sum = weights.reduce((total, weight) => total + weight, 0)
    if (sum <= 0) break
    let changed = false
    for (let index = 0; index < columns.length; index += 1) {
      const min = columnMinWidth(columns[index]?.kind)
      const current = weights[index] ?? 0
      const pixels = (current / sum) * pageWidth
      if (pixels + 0.5 >= min || pageWidth <= min) continue
      const next = (min * (sum - current)) / (pageWidth - min)
      if (next > current + 0.5) {
        weights[index] = next
        changed = true
      }
    }
    if (!changed) break
  }
  return weights
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

/**
 * Which columns stay on the first row of a list, and which drop onto the
 * band underneath.
 *
 * A laptop is about 1280px wide. Past that, a single row of columns either
 * scrolls sideways or crushes every figure. The first row keeps the columns
 * a person scans for (name, date, money, status). Everything else is still
 * shown — directly under the row, wrapping inside the page — so nothing is
 * off to the right and nothing starts hidden.
 */
export function partitionColumns<T extends { id: string }>(
  columns: T[],
  mainIds: readonly string[],
): { main: T[]; extra: T[] } {
  const keep = new Set<string>(mainIds)
  return {
    main: columns.filter((column) => keep.has(column.id)),
    extra: columns.filter((column) => !keep.has(column.id)),
  }
}

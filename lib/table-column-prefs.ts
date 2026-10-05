export type ColumnPrefs = {
  order: string[]
  hidden: string[]
}

export function readColumnPrefs(key: string): ColumnPrefs | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ColumnPrefs
    if (!parsed || !Array.isArray(parsed.order) || !Array.isArray(parsed.hidden)) return null
    return parsed
  } catch {
    return null
  }
}

export function mergeColumnPrefs(
  saved: ColumnPrefs | null,
  allIds: string[],
  defaultHidden: string[] = [],
): ColumnPrefs {
  const valid = new Set(allIds)
  const base: ColumnPrefs = saved ?? {
    order: [...allIds],
    hidden: defaultHidden.filter((id) => valid.has(id)),
  }
  const order = [
    ...base.order.filter((id) => valid.has(id)),
    ...allIds.filter((id) => !base.order.includes(id)),
  ]
  const hidden = base.hidden.filter((id) => valid.has(id))
  return { order, hidden }
}

export function visibleFromCatalog<T extends { id: string }>(
  catalog: T[],
  prefs: ColumnPrefs,
): T[] {
  const byId = new Map(catalog.map((c) => [c.id, c]))
  return prefs.order
    .filter((id) => !prefs.hidden.includes(id))
    .map((id) => byId.get(id))
    .filter((c): c is T => Boolean(c))
}

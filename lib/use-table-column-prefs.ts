'use client'

import { useCallback, useMemo } from 'react'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import {
  mergeColumnPrefs,
  visibleFromCatalog,
  type ColumnPrefs,
} from '@/lib/table-column-prefs'

function parsePrefs(raw: string | null): ColumnPrefs | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ColumnPrefs
    if (!parsed || !Array.isArray(parsed.order) || !Array.isArray(parsed.hidden)) return null
    return parsed
  } catch {
    return null
  }
}

export function useTableColumnPrefs<T extends { id: string }>(
  storageKey: string,
  catalog: T[],
  defaultHidden: string[] = [],
) {
  const allIds = useMemo(() => catalog.map((c) => c.id), [catalog])
  const raw = useBrowserStore(storageKey)
  const saved = useMemo(() => parsePrefs(raw), [raw])
  const prefs = useMemo(
    () => mergeColumnPrefs(saved, allIds, defaultHidden),
    [saved, allIds, defaultHidden],
  )

  const persist = useCallback(
    (next: ColumnPrefs) => {
      writeBrowserStore(storageKey, JSON.stringify(next))
    },
    [storageKey],
  )

  const visible = useMemo(() => visibleFromCatalog(catalog, prefs), [catalog, prefs])

  const toggle = useCallback(
    (id: string) => {
      persist({
        ...prefs,
        hidden: prefs.hidden.includes(id) ? prefs.hidden.filter((h) => h !== id) : [...prefs.hidden, id],
      })
    },
    [persist, prefs],
  )

  const reorder = useCallback(
    (from: string, to: string) => {
      if (from === to) return
      const order = [...prefs.order]
      const fromIndex = order.indexOf(from)
      const toIndex = order.indexOf(to)
      if (fromIndex < 0 || toIndex < 0) return
      order.splice(fromIndex, 1)
      order.splice(toIndex, 0, from)
      persist({ ...prefs, order })
    },
    [persist, prefs],
  )

  return { prefs, visible, toggle, reorder }
}

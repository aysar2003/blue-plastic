'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  mergeColumnPrefs,
  readColumnPrefs,
  visibleFromCatalog,
  type ColumnPrefs,
} from '@/lib/table-column-prefs'

export function useTableColumnPrefs<T extends { id: string }>(
  storageKey: string,
  catalog: T[],
  defaultHidden: string[] = [],
) {
  const allIds = useMemo(() => catalog.map((c) => c.id), [catalog])

  const [prefs, setPrefs] = useState<ColumnPrefs>(() =>
    mergeColumnPrefs(null, allIds, defaultHidden),
  )

  useEffect(() => {
    setPrefs(mergeColumnPrefs(readColumnPrefs(storageKey), allIds, defaultHidden))
  }, [storageKey, allIds, defaultHidden])

  const persist = useCallback(
    (next: ColumnPrefs) => {
      setPrefs(next)
      window.localStorage.setItem(storageKey, JSON.stringify(next))
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

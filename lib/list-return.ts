import { normalizeHref } from '@/lib/nav-trail'

export const LIST_RETURN_KEY = 'bp-list-return'

export type ListReturn = {
  listHref: string
  rowId: string
  linkHref?: string
  tableScrollTop: number
  windowScrollY: number
  at: number
}

/** Same-site path-absolute targets only. */
function isSafeHref(href: unknown): href is string {
  return (
    typeof href === 'string' &&
    href.length > 0 &&
    href.length <= 2000 &&
    href.startsWith('/') &&
    !href.startsWith('//') &&
    !href.includes('\\')
  )
}

function clampScroll(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

/** Parse what sessionStorage holds; drop malformed entries. */
export function parseListReturn(raw: string | null): ListReturn | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const value = parsed as Record<string, unknown>
  if (!isSafeHref(value.listHref) || typeof value.rowId !== 'string' || !value.rowId) return null
  if (typeof value.at !== 'number' || !Number.isFinite(value.at)) return null
  return {
    listHref: normalizeHref(value.listHref),
    rowId: value.rowId,
    ...(isSafeHref(value.linkHref) ? { linkHref: value.linkHref } : {}),
    tableScrollTop: clampScroll(value.tableScrollTop),
    windowScrollY: clampScroll(value.windowScrollY),
    at: value.at,
  }
}

export function readListReturn(): ListReturn | null {
  try {
    return parseListReturn(sessionStorage.getItem(LIST_RETURN_KEY))
  } catch {
    return null
  }
}

export function writeListReturn(value: ListReturn | null) {
  try {
    if (!value) {
      sessionStorage.removeItem(LIST_RETURN_KEY)
      return
    }
    const next: ListReturn = {
      listHref: normalizeHref(value.listHref),
      rowId: value.rowId,
      ...(value.linkHref && isSafeHref(value.linkHref) ? { linkHref: value.linkHref } : {}),
      tableScrollTop: clampScroll(value.tableScrollTop),
      windowScrollY: clampScroll(value.windowScrollY),
      at: value.at,
    }
    sessionStorage.setItem(LIST_RETURN_KEY, JSON.stringify(next))
  } catch {
    // Private mode / quota — Back still works; the marker is a convenience.
  }
}

/** True when the open screen is the list we left from. */
export function matchesListReturn(currentHref: string, saved: ListReturn | null): boolean {
  if (!saved) return false
  return normalizeHref(currentHref) === saved.listHref
}

/**
 * Snapshot the list position for a row about to open a document.
 * `listHref` is the screen currently open (pathname + search).
 */
export function captureFromRow(
  row: Element,
  input: { listHref: string; linkHref?: string | null; now?: number },
): ListReturn | null {
  if (row.hasAttribute('data-column-band')) return null
  const rowId = row.getAttribute('data-row-id')
  if (!rowId) return null
  const port = row.closest('[data-table-scroll]') as HTMLElement | null
  const linkHref = input.linkHref && isSafeHref(input.linkHref) ? input.linkHref : undefined
  return {
    listHref: normalizeHref(input.listHref),
    rowId,
    ...(linkHref ? { linkHref } : {}),
    tableScrollTop: clampScroll(port?.scrollTop ?? 0),
    windowScrollY: clampScroll(typeof window !== 'undefined' ? window.scrollY : 0),
    at: input.now ?? Date.now(),
  }
}

/** Current tab URL as pathname + search (unsorted — normalize when writing). */
export function currentListHref() {
  return `${window.location.pathname}${window.location.search}`
}

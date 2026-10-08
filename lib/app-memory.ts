/**
 * "Take me back where I was": per app, the place this user last left it.
 *
 * Kept in this browser's localStorage under a per-user key, never in the
 * database. Pure helpers here; the React side lives in
 * components/layout/app-memory.tsx.
 *
 * Each app keeps two places:
 * - `href`: the exact screen last open in that app's journey. A link followed
 *   from inside the app's own page stays in its journey even when the target
 *   lives elsewhere (Customers → QuickReport is /reports/statements/customer).
 * - `home`: the last screen under the app's own path (Customers with the same
 *   customer, tab and filters selected).
 */

export type AppPlace = {
  href: string
  home?: string
  at: number
  scrollY?: number
}

export type AppMemory = Record<string, AppPlace>

export type AppRoot = { key: string; href: string; also?: string[] }

/** How the screen just opened was reached. */
export type Arrival = 'app' | 'content' | 'other'

export const APP_MEMORY_PREFIX = 'bp-app-memory:v1:'
export const APP_RESTORE_KEY = 'bp-app-restore'
/** A place older than this is forgotten (a month of not opening that app). */
export const PLACE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_HREF = 2000

export function memoryKey(userId: string) {
  return `${APP_MEMORY_PREFIX}${userId}`
}

function samePathOrBelow(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** The app whose own path this is, by longest prefix. Home is not an app. */
export function appForPath(pathname: string, roots: AppRoot[]): string | null {
  let best: { key: string; length: number } | null = null
  for (const root of roots) {
    for (const prefix of [root.href, ...(root.also ?? [])]) {
      if (samePathOrBelow(pathname, prefix) && (!best || prefix.length > best.length)) {
        best = { key: root.key, length: prefix.length }
      }
    }
  }
  return best?.key ?? null
}

/** Screens worth coming back to. Blank forms and print sheets are not. */
export function isRememberable(href: string): boolean {
  if (!isSafeHref(href)) return false
  const pathname = href.split(/[?#]/)[0]
  if (pathname === '/' || pathname === '/dashboard') return false
  const last = pathname.split('/').filter(Boolean).pop()
  if (last === 'new' || last === 'edit' || last === 'print') return false
  if (pathname.startsWith('/quick-create')) return false
  return true
}

/** Same-site, path-absolute, sane length — never an open redirect. */
export function isSafeHref(href: unknown): href is string {
  return (
    typeof href === 'string' &&
    href.length > 0 &&
    href.length <= MAX_HREF &&
    href.startsWith('/') &&
    !href.startsWith('//') &&
    !href.includes('\\')
  )
}

/**
 * Which app's journey the screen just opened belongs to.
 * - A query-only change (filters, tab, selected row) keeps the journey.
 * - A link followed inside the page keeps the journey it came from.
 * - Anything else (app switcher, search, typed URL, a save that navigates)
 *   belongs to the app whose path it is.
 */
export function journeyOwner(input: {
  previousOwner: string | null
  previousPathname: string | null
  pathname: string
  pathApp: string | null
  arrival: Arrival
}): string | null {
  const { previousOwner, previousPathname, pathname, pathApp, arrival } = input
  if (previousOwner && previousPathname === pathname) return previousOwner
  if (previousOwner && arrival === 'content') return previousOwner
  return pathApp
}

/** Fold the screen just opened into memory for its journey owner (and its own app). */
export function rememberPlace(
  memory: AppMemory,
  input: { owner: string | null; pathApp: string | null; href: string; now: number },
): AppMemory {
  const { owner, pathApp, href, now } = input
  if (!isRememberable(href)) return memory
  const next: AppMemory = { ...memory }
  const keys = new Set([owner, pathApp].filter((key): key is string => Boolean(key)))
  for (const key of keys) {
    const before = next[key]
    const home = key === pathApp ? href : before?.home
    next[key] = {
      href,
      at: now,
      ...(home ? { home } : {}),
      ...(before && before.href === href && before.scrollY ? { scrollY: before.scrollY } : {}),
    }
  }
  return next
}

/** Keep the scroll offset for the place that is open now. */
export function rememberScroll(memory: AppMemory, href: string, scrollY: number): AppMemory {
  let changed = false
  const next: AppMemory = { ...memory }
  for (const [key, place] of Object.entries(memory)) {
    if (place.href === href && place.scrollY !== scrollY) {
      next[key] = { ...place, scrollY: Math.max(0, Math.round(scrollY)) }
      changed = true
    }
  }
  return changed ? next : memory
}

/** Drop a place that no longer opens (deleted record, lost access). */
export function forgetHref(memory: AppMemory, href: string): AppMemory {
  let changed = false
  const next: AppMemory = {}
  for (const [key, place] of Object.entries(memory)) {
    if (place.href === href) {
      changed = true
      if (place.home && place.home !== href) next[key] = { href: place.home, home: place.home, at: place.at }
      continue
    }
    if (place.home === href) {
      changed = true
      next[key] = { href: place.href, at: place.at, ...(place.scrollY ? { scrollY: place.scrollY } : {}) }
      continue
    }
    next[key] = place
  }
  return changed ? next : memory
}

/**
 * Where an app's door (tile, chip, Apps menu row) should lead.
 * First the exact place left; when that is where you already are, the app's
 * own screen; when that is here too, the app's start. So pressing the same
 * door again walks back to the beginning instead of doing nothing.
 */
export function doorHref(input: {
  memory: AppMemory
  key: string
  root: string
  currentHref: string | null
  now: number
}): string {
  const { memory, key, root, currentHref, now } = input
  const place = memory[key]
  if (!place || now - place.at > PLACE_TTL_MS) return root
  for (const candidate of [place.href, place.home]) {
    if (candidate && isSafeHref(candidate) && candidate !== currentHref) return candidate
  }
  return root
}

/** Parse what localStorage holds, dropping anything malformed or expired. */
export function parseMemory(raw: string | null, now: number): AppMemory {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const memory: AppMemory = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const place = value as Record<string, unknown>
    if (!isSafeHref(place.href) || typeof place.at !== 'number' || now - place.at > PLACE_TTL_MS) continue
    memory[key] = {
      href: place.href,
      at: place.at,
      ...(isSafeHref(place.home) ? { home: place.home } : {}),
      ...(typeof place.scrollY === 'number' && place.scrollY > 0 ? { scrollY: Math.round(place.scrollY) } : {}),
    }
  }
  return memory
}

const TRAIL_KEY = 'bp-nav-trail'

/** Stable href: pathname + sorted query (so param order does not break the trail). */
export function normalizeHref(href: string): string {
  const q = href.indexOf('?')
  if (q < 0) return href || '/'
  const path = href.slice(0, q) || '/'
  const params = new URLSearchParams(href.slice(q + 1))
  const keys = [...params.keys()].sort()
  if (keys.length === 0) return path
  const sorted = new URLSearchParams()
  for (const key of keys) {
    for (const value of params.getAll(key)) sorted.append(key, value)
  }
  return `${path}?${sorted.toString()}`
}

/** The screens this tab has actually opened, oldest first. */
export function readTrail(): string[] {
  try {
    const raw = sessionStorage.getItem(TRAIL_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((entry) => typeof entry === 'string').map(normalizeHref)
      : []
  } catch {
    return []
  }
}

export function writeTrail(trail: string[]) {
  try {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail.slice(-40)))
  } catch {
    // Private mode / quota — Back still falls back to parentOf.
  }
}

/**
 * Fold the screen just opened into the trail.
 * Returning to an earlier screen drops what came after it (forward branch).
 */
export function rememberScreen(trail: string[], href: string) {
  const screen = normalizeHref(href)
  if (!screen || screen === '/') return trail
  const tip = trail[trail.length - 1]
  if (tip && (tip === screen || sameScreen(tip, screen))) {
    // Replace tip when a /new form picks up query params.
    if (tip !== screen) return [...trail.slice(0, -1), screen]
    return trail
  }
  const seen = trail.findLastIndex((entry) => entry === screen || sameScreen(entry, screen))
  if (seen >= 0) return trail.slice(0, seen + 1)
  return [...trail, screen]
}

/** Same place even when a /new or /edit form gains query params after open. */
function sameScreen(a: string, b: string): boolean {
  if (a === b) return true
  const pathA = a.split('?')[0] ?? a
  const pathB = b.split('?')[0] ?? b
  if (pathA !== pathB) return false
  return pathA.endsWith('/new') || pathA.endsWith('/edit') || pathA.endsWith('/print')
}

/**
 * Pop the current screen and return where Back should go.
 * Uses the stack end when the current href is missing (race / till had no Back UI).
 */
export function popScreen(
  trail: string[],
  currentHref: string,
): { target: string | null; trail: string[] } {
  const current = normalizeHref(currentHref)
  let stack = [...trail]
  const tip = stack[stack.length - 1]

  if (tip !== current) {
    const seen = stack.findLastIndex((entry) => sameScreen(entry, current) || entry === current)
    if (seen >= 0) stack = stack.slice(0, seen + 1)
    else if (current) stack = [...stack, current]
  }

  if (stack.length < 2) {
    return { target: null, trail: stack }
  }

  const next = stack.slice(0, -1)
  return { target: next[next.length - 1] ?? null, trail: next }
}

/** @deprecated Prefer popScreen — kept for tests / call sites. */
export function earlierScreen(trail: string[], href: string) {
  return popScreen(trail, href).target
}

/** Where a direct visit should land when this tab has no previous screen. */
export function parentOf(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length <= 1) return '/dashboard'

  const last = parts[parts.length - 1]
  if (last === 'new') {
    parts.pop()
  } else if (last === 'print') {
    // Print sits on top of a document — Back returns to that document.
    parts.pop()
  } else if (last === 'edit') {
    parts.pop()
    if (parts.length > 1) parts.pop()
  } else {
    parts.pop()
  }

  return parts.length > 0 ? `/${parts.join('/')}` : '/dashboard'
}

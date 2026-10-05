const TRAIL_KEY = 'bp-nav-trail'

/** The screens this tab has actually opened, oldest first. */
export function readTrail(): string[] {
  try {
    const raw = sessionStorage.getItem(TRAIL_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : []
  } catch {
    return []
  }
}

export function writeTrail(trail: string[]) {
  sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail.slice(-40)))
}

/** Fold the screen just opened into the trail. Returning to an earlier one drops what came after it. */
export function rememberScreen(trail: string[], href: string) {
  if (trail[trail.length - 1] === href) return trail
  const seen = trail.lastIndexOf(href)
  if (seen >= 0) return trail.slice(0, seen + 1)
  return [...trail, href]
}

/** The screen before this one, when this tab opened it. */
export function earlierScreen(trail: string[], href: string) {
  const here = trail.lastIndexOf(href)
  if (here > 0) return trail[here - 1] ?? null
  return null
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

/**
 * Previously used delete reasons, remembered on this browser and merged with
 * whatever the org has already written into Trash.
 */

export const DELETE_REASONS_KEY = 'bp-delete-reasons'
const MAX = 24

export function parseDeleteReasons(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return uniqueReasons(parsed.filter((entry): entry is string => typeof entry === 'string'))
  } catch {
    return []
  }
}

export function uniqueReasons(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= MAX) break
  }
  return out
}

/** Put a freshly used reason at the front of the list. */
export function rememberDeleteReason(existing: string[], reason: string): string[] {
  return uniqueReasons([reason, ...existing])
}

/** Reasons that match what is being typed (empty query → all, newest first). */
export function filterDeleteReasons(reasons: string[], query: string): string[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return reasons
  return reasons.filter((reason) => reason.toLowerCase().includes(needle))
}

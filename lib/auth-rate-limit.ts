/**
 * Sliding-window sign-in rate limit (per identifier). In-memory — fine for a
 * single Node process; not shared across replicas.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 20

export function assertSignInRateLimit(identifier: string): void {
  const key = identifier.trim().toLowerCase()
  if (!key) return
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  existing.count += 1
  if (existing.count > MAX_ATTEMPTS) {
    const err = new Error(
      'Too many sign-in attempts. Wait 15 minutes, or try again later.',
    )
    ;(err as Error & { code: string }).code = 'RATE_LIMITED'
    throw err
  }
}

export function clearSignInRateLimit(identifier: string): void {
  buckets.delete(identifier.trim().toLowerCase())
}

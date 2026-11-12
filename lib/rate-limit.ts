/**
 * Process-local sliding-window rate limit. Prefer `assertRateLimitAsync` from
 * `@/server/rate-limit` on Node routes so limits are shared across replicas.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export type RateLimitOptions = {
  /** Max attempts inside the window (inclusive of the current call). */
  max: number
  /** Window length in milliseconds. */
  windowMs: number
  /** Message thrown when the limit is exceeded. */
  message?: string
}

export function assertRateLimit(key: string, options: RateLimitOptions): void {
  const id = key.trim().toLowerCase()
  if (!id) return
  const now = Date.now()
  const existing = buckets.get(id)
  if (!existing || existing.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + options.windowMs })
    return
  }
  existing.count += 1
  if (existing.count > options.max) {
    const err = new Error(
      options.message ?? 'Too many attempts. Wait a few minutes, then try again.',
    )
    ;(err as Error & { code: string }).code = 'RATE_LIMITED'
    throw err
  }
}

export function clearRateLimit(key: string): void {
  buckets.delete(key.trim().toLowerCase())
}

/** Best-effort client IP from proxy headers (Vercel / reverse proxy). */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

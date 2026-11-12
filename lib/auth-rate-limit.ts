/**
 * Sliding-window sign-in rate limit (per identifier).
 * Async + DB-backed on the server so replicas share the same counter.
 */

import type { RateLimitOptions } from '@/lib/rate-limit'

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 20

const signInOptions: RateLimitOptions = {
  max: MAX_ATTEMPTS,
  windowMs: WINDOW_MS,
  message: 'Too many sign-in attempts. Wait 15 minutes, or try again later.',
}

export async function assertSignInRateLimit(identifier: string): Promise<void> {
  const { assertRateLimitAsync } = await import('@/server/rate-limit')
  await assertRateLimitAsync(`signin:${identifier}`, signInOptions)
}

export async function clearSignInRateLimit(identifier: string): Promise<void> {
  const { clearRateLimitAsync } = await import('@/server/rate-limit')
  await clearRateLimitAsync(`signin:${identifier}`)
}

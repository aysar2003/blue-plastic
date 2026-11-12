import 'server-only'

import { assertRateLimit, clearRateLimit, type RateLimitOptions } from '@/lib/rate-limit'
import { db } from '@/server/db'

function rateLimitedError(message: string): Error {
  const err = new Error(message)
  ;(err as Error & { code: string }).code = 'RATE_LIMITED'
  return err
}

/**
 * Sliding-window limit shared across serverless replicas via Postgres.
 * Falls back to process-local memory if the bucket table is unavailable.
 */
export async function assertRateLimitAsync(key: string, options: RateLimitOptions): Promise<void> {
  const id = key.trim().toLowerCase()
  if (!id) return
  const message = options.message ?? 'Too many attempts. Wait a few minutes, then try again.'
  const resetAt = new Date(Date.now() + options.windowMs)

  try {
    const rows = await db.$queryRaw<Array<{ count: number }>>`
      INSERT INTO rate_limit_buckets (key, count, "resetAt")
      VALUES (${id}, 1, ${resetAt})
      ON CONFLICT (key) DO UPDATE
      SET
        count = CASE
          WHEN rate_limit_buckets."resetAt" <= NOW() THEN 1
          ELSE rate_limit_buckets.count + 1
        END,
        "resetAt" = CASE
          WHEN rate_limit_buckets."resetAt" <= NOW() THEN ${resetAt}
          ELSE rate_limit_buckets."resetAt"
        END
      RETURNING count
    `
    const count = Number(rows[0]?.count ?? 0)
    if (count > options.max) throw rateLimitedError(message)
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === 'RATE_LIMITED') {
      throw error
    }
    assertRateLimit(id, options)
  }
}

export async function clearRateLimitAsync(key: string): Promise<void> {
  const id = key.trim().toLowerCase()
  clearRateLimit(id)
  try {
    await db.rateLimitBucket.deleteMany({ where: { key: id } })
  } catch {
    /* ignore */
  }
}

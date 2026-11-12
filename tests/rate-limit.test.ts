import { describe, expect, it } from 'vitest'

import { assertRateLimit, clearRateLimit } from '@/lib/rate-limit'

describe('assertRateLimit', () => {
  it('allows up to max attempts then throws RATE_LIMITED', () => {
    const key = `test-${Date.now()}-${Math.random()}`
    clearRateLimit(key)
    assertRateLimit(key, { max: 3, windowMs: 60_000 })
    assertRateLimit(key, { max: 3, windowMs: 60_000 })
    assertRateLimit(key, { max: 3, windowMs: 60_000 })
    expect(() => assertRateLimit(key, { max: 3, windowMs: 60_000 })).toThrow(/Too many/)
    try {
      assertRateLimit(key, { max: 3, windowMs: 60_000 })
    } catch (error) {
      expect((error as Error & { code?: string }).code).toBe('RATE_LIMITED')
    }
    clearRateLimit(key)
  })
})

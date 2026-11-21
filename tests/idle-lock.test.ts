import { describe, expect, it } from 'vitest'

import { IDLE_LOCK_MS } from '@/components/security/idle-lock'
import {
  DEFAULT_IDLE_LOCK_SECONDS,
  DEFAULT_SESSION_MAX_HOURS,
  IDLE_LOCK_PRESETS,
  SESSION_LOGOUT_PRESETS,
  clampIdleLockSeconds,
  clampSessionMaxHours,
  formatIdleLockLabel,
} from '@/lib/desk-security'

describe('desk security defaults', () => {
  it('defaults idle lock to 15 minutes', () => {
    expect(DEFAULT_IDLE_LOCK_SECONDS).toBe(15 * 60)
    expect(IDLE_LOCK_MS).toBe(DEFAULT_IDLE_LOCK_SECONDS * 1000)
  })

  it('defaults session logout to 10 hours', () => {
    expect(DEFAULT_SESSION_MAX_HOURS).toBe(10)
  })

  it('exposes lock presets including 30s through 30m', () => {
    const seconds = IDLE_LOCK_PRESETS.map((row) => row.seconds)
    expect(seconds).toEqual([30, 60, 300, 600, 900, 1800])
  })

  it('exposes session presets including custom ceiling of 24h', () => {
    const hours = SESSION_LOGOUT_PRESETS.map((row) => row.hours)
    expect(hours).toContain(10)
    expect(hours).toContain(24)
  })

  it('clamps idle and session values', () => {
    expect(clampIdleLockSeconds(5)).toBe(30)
    expect(clampIdleLockSeconds(999_999)).toBe(24 * 60 * 60)
    expect(clampSessionMaxHours(0)).toBe(1)
    expect(clampSessionMaxHours(48)).toBe(24)
  })

  it('formats idle labels', () => {
    expect(formatIdleLockLabel(900)).toBe('15 minutes')
    expect(formatIdleLockLabel(30)).toBe('30 seconds')
  })
})

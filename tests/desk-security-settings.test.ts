import { describe, expect, it } from 'vitest'

import {
  DEFAULT_IDLE_LOCK_SECONDS,
  DEFAULT_SESSION_MAX_HOURS,
  IDLE_LOCK_PRESETS,
  SESSION_LOGOUT_PRESETS,
  clampIdleLockSeconds,
  clampSessionMaxHours,
  formatIdleLockLabel,
} from '@/lib/desk-security'
import { organizationSecuritySchema } from '@/lib/validation/organization'

describe('desk security settings validation', () => {
  it('accepts preset idle + session values', () => {
    for (const row of IDLE_LOCK_PRESETS) {
      const parsed = organizationSecuritySchema.safeParse({
        idleLockSeconds: row.seconds,
        sessionMaxHours: DEFAULT_SESSION_MAX_HOURS,
      })
      expect(parsed.success).toBe(true)
      if (parsed.success) expect(parsed.data.idleLockSeconds).toBe(row.seconds)
    }

    for (const row of SESSION_LOGOUT_PRESETS) {
      const parsed = organizationSecuritySchema.safeParse({
        idleLockSeconds: DEFAULT_IDLE_LOCK_SECONDS,
        sessionMaxHours: row.hours,
      })
      expect(parsed.success).toBe(true)
      if (parsed.success) expect(parsed.data.sessionMaxHours).toBe(row.hours)
    }
  })

  it('accepts custom values within clamps', () => {
    const parsed = organizationSecuritySchema.safeParse({
      idleLockSeconds: 45,
      sessionMaxHours: 7,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.idleLockSeconds).toBe(45)
      expect(parsed.data.sessionMaxHours).toBe(7)
    }
  })

  it('clamps out-of-range form values', () => {
    expect(clampIdleLockSeconds(10)).toBe(30)
    expect(clampSessionMaxHours(100)).toBe(24)
    const parsed = organizationSecuritySchema.safeParse({
      idleLockSeconds: 5,
      sessionMaxHours: 99,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.idleLockSeconds).toBe(30)
      expect(parsed.data.sessionMaxHours).toBe(24)
    }
  })

  it('formats lock label for lock overlay copy', () => {
    expect(formatIdleLockLabel(30)).toBe('30 seconds')
    expect(formatIdleLockLabel(60)).toBe('1 minute')
    expect(formatIdleLockLabel(900)).toBe('15 minutes')
  })
})

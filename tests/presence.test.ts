import { describe, expect, it } from 'vitest'

import {
  isUserOnline,
  presenceActivityLabel,
  presenceLabel,
  PRESENCE_ONLINE_MS,
} from '@/lib/presence'

describe('presence', () => {
  const now = new Date('2026-11-27T18:00:00.000Z')

  it('marks recent heartbeats as online', () => {
    expect(isUserOnline(new Date(now.getTime() - 30_000), now)).toBe(true)
    expect(isUserOnline(new Date(now.getTime() - PRESENCE_ONLINE_MS), now)).toBe(true)
    expect(isUserOnline(new Date(now.getTime() - PRESENCE_ONLINE_MS - 1), now)).toBe(false)
    expect(isUserOnline(null, now)).toBe(false)
  })

  it('labels activity for lists', () => {
    expect(presenceLabel(true)).toBe('Online')
    expect(presenceLabel(false)).toBe('Offline')
    expect(presenceActivityLabel(new Date(now.getTime() - 20_000), now)).toBe('Online now')
    expect(presenceActivityLabel(new Date(now.getTime() - 5 * 60_000), now)).toBe('5m ago')
    expect(presenceActivityLabel(null, now)).toBe('—')
  })
})

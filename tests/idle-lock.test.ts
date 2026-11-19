import { describe, expect, it } from 'vitest'

import { IDLE_LOCK_MS } from '@/components/security/idle-lock'

describe('idle lock policy', () => {
  it('locks after 15 minutes of inactivity', () => {
    expect(IDLE_LOCK_MS).toBe(15 * 60 * 1000)
  })
})

import { describe, expect, it } from 'vitest'

import { isCashierPin } from '@/lib/pos-pin'
import { openRegisterUnlock, sealRegisterUnlock } from '@/lib/pos-unlock-token'

const SECRET = 'test-secret-at-least-32-characters-long'
const TTL_MS = 12 * 60 * 60 * 1000

describe('isCashierPin', () => {
  it('accepts letters or numbers, at least 4, longer allowed', () => {
    expect(isCashierPin('1234')).toBe(true)
    expect(isCashierPin('Ab12')).toBe(true)
    expect(isCashierPin('cashier19')).toBe(true)
    expect(isCashierPin('a'.repeat(64))).toBe(true)
  })

  it('rejects short, spaced, symbolic, or oversized values', () => {
    expect(isCashierPin('')).toBe(false)
    expect(isCashierPin('abc')).toBe(false)
    expect(isCashierPin('ab cd')).toBe(false)
    expect(isCashierPin('pin!')).toBe(false)
    expect(isCashierPin('a'.repeat(65))).toBe(false)
  })
})

describe('register unlock token', () => {
  it('round-trips the register it was sealed for', () => {
    const token = sealRegisterUnlock({
      orgId: 'org-1',
      registerId: 'reg-a',
      secret: SECRET,
      now: 1_000,
    })
    expect(openRegisterUnlock(token, SECRET, 1_000)).toEqual({
      orgId: 'org-1',
      registerId: 'reg-a',
    })
    expect(openRegisterUnlock(token, SECRET, 1_000 + TTL_MS - 1)?.registerId).toBe('reg-a')
  })

  it('rejects a tampered token, the wrong secret, and an expired token', () => {
    const token = sealRegisterUnlock({
      orgId: 'org-1',
      registerId: 'reg-a',
      secret: SECRET,
      now: 1_000,
    })
    const [body, sig] = token.split('.')
    expect(openRegisterUnlock(`${body}x.${sig}`, SECRET)).toBeNull()
    expect(openRegisterUnlock(`${body}.${sig.slice(0, -1)}y`, SECRET)).toBeNull()
    expect(openRegisterUnlock(token, `${SECRET}-other`)).toBeNull()
    expect(openRegisterUnlock(token, SECRET, 1_000 + TTL_MS)).toBeNull()
    expect(openRegisterUnlock('not-a-token', SECRET)).toBeNull()
  })
})

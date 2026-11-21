import { describe, expect, it } from 'vitest'

import {
  DESK_PIN_LENGTHS,
  isDeskPin,
  isDeskPinLength,
  normalizeDeskPin,
} from '@/lib/desk-unlock'
import { isCashierPin } from '@/lib/pos-pin'
import { setDeskPinSchema, unlockIdleScreenSchema } from '@/lib/validation/user'

describe('desk unlock PIN', () => {
  it('allows only 4, 6, 8, or 10 digits', () => {
    expect(DESK_PIN_LENGTHS).toEqual([4, 6, 8, 10])
    expect(isDeskPin('1234')).toBe(true)
    expect(isDeskPin('123456')).toBe(true)
    expect(isDeskPin('12345678')).toBe(true)
    expect(isDeskPin('1234567890')).toBe(true)
    expect(isDeskPin('12345')).toBe(false)
    expect(isDeskPin('123')).toBe(false)
    expect(isDeskPin('12ab')).toBe(false)
    expect(isDeskPinLength(4)).toBe(true)
    expect(isDeskPinLength(5)).toBe(false)
  })

  it('normalizes trim for PIN input', () => {
    expect(normalizeDeskPin(' 1234 ')).toBe('1234')
  })

  it('validates setDeskPin schema', () => {
    const ok = setDeskPinSchema.safeParse({
      currentPassword: 'secret1',
      pin: '1234',
      confirmPin: '1234',
    })
    expect(ok.success).toBe(true)

    const badLen = setDeskPinSchema.safeParse({
      currentPassword: 'secret1',
      pin: '12345',
      confirmPin: '12345',
    })
    expect(badLen.success).toBe(false)

    const mismatch = setDeskPinSchema.safeParse({
      currentPassword: 'secret1',
      pin: '1234',
      confirmPin: '9999',
    })
    expect(mismatch.success).toBe(false)
  })

  it('validates unlock method routing', () => {
    expect(
      unlockIdleScreenSchema.safeParse({ method: 'password', secret: 'x' }).success,
    ).toBe(true)
    expect(unlockIdleScreenSchema.safeParse({ method: 'pin', secret: '1234' }).success).toBe(
      true,
    )
    expect(unlockIdleScreenSchema.safeParse({ method: 'pattern', secret: 'x' }).success).toBe(
      false,
    )
  })

  it('stays separate from POS till PIN rules', () => {
    // Desk: digits only, fixed lengths. Till: letters/numbers, 4–64.
    expect(isDeskPin('Ab12')).toBe(false)
    expect(isCashierPin('Ab12')).toBe(true)
    expect(isDeskPin('12345')).toBe(false)
    expect(isCashierPin('12345')).toBe(true)
    expect(isDeskPin('1234567890')).toBe(true)
    expect(isCashierPin('1234567890')).toBe(true)
  })
})

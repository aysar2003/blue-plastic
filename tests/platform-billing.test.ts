import { describe, expect, it } from 'vitest'

import { isSelfServeApprovalRequired } from '@/lib/self-serve'
import {
  extendRentExpiry,
  reviewRentPaymentSchema,
  submitRentPaymentSchema,
} from '@/lib/validation/platform-billing'

describe('extendRentExpiry', () => {
  it('extends from now when rent already ended', () => {
    const now = new Date('2026-10-25T12:00:00.000Z')
    const next = extendRentExpiry('2020-01-01T00:00:00.000Z', 1, now)
    expect(next.toISOString()).toBe('2026-11-25T12:00:00.000Z')
  })

  it('extends from current expiry when still active', () => {
    const now = new Date('2026-10-25T12:00:00.000Z')
    const next = extendRentExpiry('2026-11-10T00:00:00.000Z', 3, now)
    expect(next.toISOString()).toBe('2027-02-10T00:00:00.000Z')
  })

  it('extends from now when there is no expiry', () => {
    const now = new Date('2026-10-25T12:00:00.000Z')
    const next = extendRentExpiry(null, 12, now)
    expect(next.toISOString()).toBe('2027-10-25T12:00:00.000Z')
  })
})

describe('submitRentPaymentSchema', () => {
  it('accepts a valid EVC proof', () => {
    const ok = submitRentPaymentSchema.safeParse({
      planId: 'plan_starter',
      method: 'EVC',
      amount: '30',
      reference: 'TXN-12345',
    })
    expect(ok.success).toBe(true)
  })

  it('rejects a short reference', () => {
    const bad = submitRentPaymentSchema.safeParse({
      planId: 'plan_starter',
      method: 'ZAAD',
      amount: 10,
      reference: 'ab',
    })
    expect(bad.success).toBe(false)
  })
})

describe('reviewRentPaymentSchema', () => {
  it('requires confirm or reject', () => {
    expect(
      reviewRentPaymentSchema.safeParse({ id: 'pay_1', decision: 'confirm' }).success,
    ).toBe(true)
    expect(
      reviewRentPaymentSchema.safeParse({ id: 'pay_1', decision: 'maybe' }).success,
    ).toBe(false)
  })
})

describe('isSelfServeApprovalRequired', () => {
  it('defaults to instant create (approval off)', () => {
    const prev = process.env.SELF_SERVE_REQUIRE_APPROVAL
    delete process.env.SELF_SERVE_REQUIRE_APPROVAL
    expect(isSelfServeApprovalRequired()).toBe(false)
    process.env.SELF_SERVE_REQUIRE_APPROVAL = 'true'
    expect(isSelfServeApprovalRequired()).toBe(true)
    if (prev === undefined) delete process.env.SELF_SERVE_REQUIRE_APPROVAL
    else process.env.SELF_SERVE_REQUIRE_APPROVAL = prev
  })
})

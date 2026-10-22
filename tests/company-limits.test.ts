import { describe, expect, it } from 'vitest'

import { companyLimitStatus, wouldExceedMaxUsers } from '@/lib/company-limits'

describe('company limits', () => {
  it('blocks when access is restricted', () => {
    const status = companyLimitStatus({
      accessRestricted: true,
      rentExpiresAt: null,
      maxUsers: null,
    })
    expect(status.openBlocked).toBe(true)
    expect(status.blockReason).toMatch(/locked/i)
  })

  it('blocks when rent has ended', () => {
    const status = companyLimitStatus(
      {
        accessRestricted: false,
        rentExpiresAt: '2020-01-01T00:00:00.000Z',
        maxUsers: 5,
      },
      new Date('2026-10-12T00:00:00.000Z'),
    )
    expect(status.rentExpired).toBe(true)
    expect(status.openBlocked).toBe(true)
  })

  it('allows open when rent is in the future', () => {
    const status = companyLimitStatus(
      {
        accessRestricted: false,
        rentExpiresAt: '2099-01-01T00:00:00.000Z',
        maxUsers: 3,
        rentNote: 'Monthly',
      },
      new Date('2026-10-12T00:00:00.000Z'),
    )
    expect(status.openBlocked).toBe(false)
    expect(status.rentNote).toBe('Monthly')
    expect(status.onTrial).toBe(false)
  })

  it('marks free trial while rent note says trial', () => {
    const status = companyLimitStatus(
      {
        accessRestricted: false,
        rentExpiresAt: '2026-10-26T00:00:00.000Z',
        maxUsers: null,
        rentNote: 'Free trial',
      },
      new Date('2026-10-12T00:00:00.000Z'),
    )
    expect(status.onTrial).toBe(true)
    expect(status.daysLeft).toBe(14)
    expect(status.openBlocked).toBe(false)
  })

  it('detects seat cap', () => {
    expect(wouldExceedMaxUsers(3, 3)).toBe(true)
    expect(wouldExceedMaxUsers(3, 2)).toBe(false)
    expect(wouldExceedMaxUsers(null, 99)).toBe(false)
  })
})

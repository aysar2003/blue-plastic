import { describe, expect, it } from 'vitest'

import { collectionDueDate, isCollectionOverdue } from '@/lib/invoice-overdue'

describe('invoice overdue / registration promise', () => {
  it('uses a later payment promise when set', () => {
    expect(
      collectionDueDate({ dueDate: '2026-01-01', promisedDate: '2026-02-15' }),
    ).toBe('2026-02-15')
    expect(collectionDueDate({ dueDate: '2026-01-01', promisedDate: null })).toBe('2026-01-01')
  })

  it('uses the registration balance date before the work due date', () => {
    expect(
      collectionDueDate({
        dueDate: '2026-12-01',
        partyBalanceDate: '2026-09-15',
        partyBalanceTime: '14:30',
      }),
    ).toBe('2026-09-15')
    expect(
      collectionDueDate({
        dueDate: '2026-09-01',
        partyAgreementDate: '2026-11-01',
      }),
    ).toBe('2026-11-01')
  })

  it('falls back to the work due date when no registration promise was written', () => {
    expect(collectionDueDate({ dueDate: '2026-01-01', promisedDate: null })).toBe('2026-01-01')
  })

  it('treats excludeFromOverdue as not overdue', () => {
    expect(
      isCollectionOverdue(
        {
          status: 'OPEN',
          dueDate: '2026-01-01',
          excludeFromOverdue: true,
        },
        '2026-10-12',
      ),
    ).toBe(false)
  })

  it('is overdue when the registration promise has passed, even if work due is later', () => {
    expect(
      isCollectionOverdue(
        { status: 'OPEN', dueDate: '2026-12-01', partyBalanceDate: '2026-09-01' },
        '2026-10-12',
      ),
    ).toBe(true)
  })

  it('is not overdue when the registration promise is still ahead, even if work due has passed', () => {
    expect(
      isCollectionOverdue(
        { status: 'OPEN', dueDate: '2026-01-01', partyBalanceDate: '2026-11-01' },
        '2026-10-12',
      ),
    ).toBe(false)
  })

  it('uses the registration clock time on the promise day', () => {
    const clock = { now: new Date('2026-10-12T12:00:00.000Z'), timeZone: 'UTC' }
    expect(
      isCollectionOverdue(
        { status: 'OPEN', dueDate: '2026-12-01', partyBalanceDate: '2026-10-12', partyBalanceTime: '11:00' },
        '2026-10-12',
        clock,
      ),
    ).toBe(true)
    expect(
      isCollectionOverdue(
        { status: 'OPEN', dueDate: '2026-12-01', partyBalanceDate: '2026-10-12', partyBalanceTime: '13:00' },
        '2026-10-12',
        clock,
      ),
    ).toBe(false)
  })

  it('is overdue when collection due is before as-of', () => {
    expect(
      isCollectionOverdue(
        { status: 'OPEN', dueDate: '2026-01-01', promisedDate: '2026-09-01' },
        '2026-10-12',
      ),
    ).toBe(true)
    expect(
      isCollectionOverdue(
        { status: 'OPEN', dueDate: '2026-01-01', promisedDate: '2026-11-01' },
        '2026-10-12',
      ),
    ).toBe(false)
  })
})

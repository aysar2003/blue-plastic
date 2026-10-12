import { describe, expect, it } from 'vitest'

import { collectionDueDate, isCollectionOverdue } from '@/lib/invoice-overdue'

describe('invoice overdue / payment promise', () => {
  it('uses promised date when set', () => {
    expect(
      collectionDueDate({ dueDate: '2026-01-01', promisedDate: '2026-02-15' }),
    ).toBe('2026-02-15')
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

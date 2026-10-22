import { describe, expect, it } from 'vitest'

import { documentPackSearch, parsePackIds, sortPackDocuments } from '@/lib/document-pack'

describe('document pack ids', () => {
  it('keeps unique ids in order and caps the pack', () => {
    expect(parsePackIds(' a, b, a, c ')).toEqual(['a', 'b', 'c'])
    expect(parsePackIds('')).toEqual([])
    expect(parsePackIds(null)).toEqual([])
  })
})

describe('document pack sort', () => {
  it('prints oldest first', () => {
    const rows = sortPackDocuments([
      { date: '2026-10-20', number: 'QT-2' },
      { date: '2026-10-18', number: 'QT-1' },
      { date: '2026-10-20', number: 'QT-0' },
    ])
    expect(rows.map((row) => row.number)).toEqual(['QT-1', 'QT-0', 'QT-2'])
  })
})

describe('document pack search', () => {
  it('prefers selected papers over the customer filter', () => {
    expect(documentPackSearch({ ids: ['one', 'two'], customer: 'cust' })).toBe('ids=one%2Ctwo')
    expect(documentPackSearch({ customer: 'cust', date: 'last3' })).toBe('customer=cust&date=last3')
  })
})

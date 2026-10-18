import { describe, expect, it } from 'vitest'

import {
  actionLabel,
  entityLabel,
  userHistoryDetail,
  userHistoryHref,
  userHistoryRetentionStart,
  USER_HISTORY_RETENTION_DAYS,
} from './user-history'

describe('user-history', () => {
  it('keeps a one-year window', () => {
    const now = new Date('2026-10-18T12:00:00.000Z')
    const start = userHistoryRetentionStart(now)
    const days = (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
    expect(days).toBe(USER_HISTORY_RETENTION_DAYS)
  })

  it('labels sign-in and sales work', () => {
    expect(actionLabel('LOGIN')).toBe('Signed in')
    expect(actionLabel('LOGOUT')).toBe('Signed out')
    expect(entityLabel('SalesDocument')).toBe('Sale')
  })

  it('reads a document number from the audit payload', () => {
    expect(userHistoryDetail({ number: 'INV-1' }, null)).toBe('INV-1')
    expect(userHistoryDetail(null, { displayName: 'Acme' })).toBe('Acme')
  })

  it('does not open deleted or login rows', () => {
    expect(userHistoryHref('DELETE', 'SalesDocument', 'x', { type: 'INVOICE' })).toBeNull()
    expect(userHistoryHref('LOGIN', 'User', 'x', null)).toBeNull()
    expect(userHistoryHref('CREATE', 'SalesDocument', 'abc', { type: 'INVOICE' })).toBe(
      '/sales/invoices/abc',
    )
  })

  it('opens a restored sale using type from before when after has none', () => {
    expect(
      userHistoryHref('RESTORE', 'SalesDocument', 'abc', { deletedAt: null }, { type: 'INVOICE', number: 'INV-1' }),
    ).toBe('/sales/invoices/abc')
    expect(actionLabel('RESTORE')).toBe('Restored')
  })
})

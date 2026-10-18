import { describe, expect, it } from 'vitest'

import { presentTrashEntry, trashOrigin, trashRestoreCapability } from './trash-log'

const at = new Date('2026-10-10T12:00:00.000Z')

describe('presentTrashEntry', () => {
  it('names an invoice by its number and keeps the reason, without an id or a link', () => {
    const entry = presentTrashEntry({
      id: 'log-1',
      entity: 'SalesDocument',
      at,
      before: { number: 'INV-22409', type: 'INVOICE', total: '11111.00' },
      after: { deletedAt: at.toISOString(), reason: 'Entered twice' },
      actor: { name: 'Amina', email: 'amina@example.com' },
    })

    expect(entry).toEqual({
      id: 'log-1',
      at,
      who: 'Amina',
      email: 'amina@example.com',
      kind: 'Invoice',
      name: 'INV-22409',
      reason: 'Entered twice',
    })
    expect(JSON.stringify(entry)).not.toContain('href')
    expect(JSON.stringify(entry)).not.toContain('entityId')
  })

  it('drops a database id when that is the only thing stored', () => {
    const entry = presentTrashEntry({
      id: 'log-2',
      entity: 'SalesApplication',
      at,
      before: { invoiceId: 'cm9abc123def456ghi789jkl01', amount: '10.00' },
      after: null,
      actor: null,
    })

    expect(entry.kind).toBe('Payment application')
    expect(entry.name).toBeNull()
    expect(entry.who).toBe('System')
    expect(entry.reason).toBeNull()
  })

  it('names a manual journal by the entry numbers that left the books', () => {
    const entry = presentTrashEntry({
      id: 'log-3',
      entity: 'Journal',
      at,
      before: { entries: ['JE-00012', 'JE-00013'] },
      after: { status: 'DELETED', reason: 'Wrong month' },
      actor: { name: 'Owner', email: 'owner@example.com' },
    })

    expect(entry.kind).toBe('Journal')
    expect(entry.name).toBe('JE-00012, JE-00013')
    expect(entry.reason).toBe('Wrong month')
  })

  it('keeps a written reason even when it looks like a database id', () => {
    const entry = presentTrashEntry({
      id: 'log-4',
      entity: 'SalesDocument',
      at,
      before: { number: 'INV-1', type: 'INVOICE' },
      after: { deletedAt: at.toISOString(), reason: 'cm9abc123def456ghi789jkl01' },
      actor: { name: 'Amina', email: 'amina@example.com' },
    })

    expect(entry.reason).toBe('cm9abc123def456ghi789jkl01')
  })

  it('points an invoice back to the sales invoices list', () => {
    expect(trashOrigin('SalesDocument', { type: 'INVOICE', number: 'INV-1' })).toEqual({
      label: 'Sales · Invoices',
      href: '/sales/invoices',
    })
  })
})

describe('trashRestoreCapability', () => {
  it('allows invoices and blocks deposits', () => {
    expect(trashRestoreCapability('SalesDocument').canRestore).toBe(true)
    expect(trashRestoreCapability('Deposit').canRestore).toBe(false)
    expect(trashRestoreCapability('Deposit').cannotRestoreReason).toMatch(/Deposits/)
  })
})

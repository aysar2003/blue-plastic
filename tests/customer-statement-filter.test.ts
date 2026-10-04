import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { entryVisible, readStatementFilter, type FilterableEntry } from '@/lib/customer-statement'
import { buildTextPdf } from '@/lib/pdf-text'

function row(partial: Partial<FilterableEntry> & Pick<FilterableEntry, 'kind'>): FilterableEntry {
  return {
    openAmount: new Decimal(0),
    dueDate: null,
    ...partial,
  }
}

describe('customer statement filters', () => {
  it('keeps estimates off the regular statement until that type is chosen', () => {
    const estimate = row({ kind: 'ESTIMATE' })
    const invoice = row({ kind: 'INVOICE', openAmount: new Decimal(10), dueDate: new Date('2026-10-02T00:00:00Z') })
    const filter = readStatementFilter({})
    expect(entryVisible(estimate, filter, '2026-10-03')).toBe(false)
    expect(entryVisible(invoice, filter, '2026-10-03')).toBe(true)
    expect(entryVisible(estimate, readStatementFilter({ type: 'estimate' }), '2026-10-03')).toBe(true)
    expect(readStatementFilter({ view: 'arrow' }).view).toBe('arrow')
    expect(readStatementFilter({ view: 'detail' }).view).toBe('detail')
    expect(readStatementFilter({}).view).toBe('detail')
  })

  it('treats an invoice due yesterday as overdue and a paid one as paid', () => {
    const overdue = row({
      kind: 'INVOICE',
      openAmount: new Decimal('103.46'),
      dueDate: new Date('2026-10-02T00:00:00Z'),
    })
    const paid = row({ kind: 'INVOICE', openAmount: new Decimal(0), dueDate: new Date('2026-10-02T00:00:00Z') })
    expect(entryVisible(overdue, readStatementFilter({ status: 'overdue' }), '2026-10-03')).toBe(true)
    expect(entryVisible(paid, readStatementFilter({ status: 'overdue' }), '2026-10-03')).toBe(false)
    expect(entryVisible(paid, readStatementFilter({ status: 'paid' }), '2026-10-03')).toBe(true)
    expect(entryVisible(overdue, readStatementFilter({ status: 'open' }), '2026-10-03')).toBe(true)
  })

  it('writes a PDF that names the statement', () => {
    const bytes = buildTextPdf([
      { runs: [{ text: 'Customer statement', x: 40, bold: true }], size: 12, height: 16 },
    ])
    const text = new TextDecoder().decode(bytes)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('Customer statement')
  })
})
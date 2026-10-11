import { describe, expect, it } from 'vitest'

import { Decimal, ZERO } from '@/lib/money'
import {
  entryVisible,
  forwardBalances,
  readStatementFilter,
  signedOpen,
  type FilterableEntry,
} from '@/lib/customer-statement'
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
    expect(readStatementFilter({}).view).toBe('regular')
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

describe('statement running balance', () => {
  it('lowers the balance for an unapplied payment the same way as an applied one', () => {
    const opening = new Decimal(0)
    const unapplied = forwardBalances(
      [
        {
          id: 'inv',
          kind: 'INVOICE',
          charge: new Decimal(100),
          credit: ZERO,
          openAmount: new Decimal(100),
        },
        {
          id: 'pay',
          kind: 'PAYMENT',
          charge: ZERO,
          credit: new Decimal(40),
          openAmount: new Decimal(40),
        },
      ],
      opening,
    )
    expect(unapplied.byId.get('pay')?.toString()).toBe('60')
    expect(unapplied.closing.toString()).toBe('60')

    const applied = forwardBalances(
      [
        {
          id: 'inv',
          kind: 'INVOICE',
          charge: new Decimal(100),
          credit: ZERO,
          openAmount: new Decimal(60),
        },
        {
          id: 'pay',
          kind: 'PAYMENT',
          charge: ZERO,
          credit: new Decimal(40),
          openAmount: ZERO,
        },
      ],
      opening,
    )
    expect(applied.closing.toString()).toBe('60')
  })

  it('nets unapplied payment open amounts against invoice remainders', () => {
    expect(
      signedOpen({ kind: 'INVOICE', openAmount: new Decimal(100) })
        .plus(signedOpen({ kind: 'PAYMENT', openAmount: new Decimal(40) }))
        .toString(),
    ).toBe('60')
  })

  it('drops 1908.50 by a 712.50 payment to 1196 (MALL GROUP case)', () => {
    const afterInvoice = new Decimal('1908.50')
    const payment = new Decimal('712.50')
    const result = forwardBalances(
      [
        {
          id: 'inv-303',
          kind: 'INVOICE',
          charge: new Decimal('281'),
          credit: ZERO,
          openAmount: new Decimal('281'),
        },
        {
          id: 'pmt-12560',
          kind: 'PAYMENT',
          charge: ZERO,
          credit: payment,
          openAmount: payment,
        },
      ],
      afterInvoice.minus(281),
    )
    expect(result.byId.get('inv-303')?.toString()).toBe('1908.5')
    expect(result.byId.get('pmt-12560')?.toString()).toBe('1196')
    expect(result.closing.toString()).toBe('1196')
    expect(afterInvoice.minus(payment).toString()).toBe('1196')
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/reports/statements/customer',
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}))

import { readSettings } from '@/app/(app)/reports/params'
import { StatementInvoices } from '@/app/(app)/reports/statements/[kind]/statement-invoices'
import { StatementFilters } from '@/components/reports/statement-filters'
import { InvoiceSheet } from '@/components/sales/invoice-sheet'
import { customerQuickReportHref, vendorQuickReportHref } from '@/lib/contact-menus'
import { readStatementFilter, statementInvoices, type StatementKind } from '@/lib/customer-statement'
import { DEFAULT_DOCUMENT_TEMPLATE } from '@/lib/document-template'
import { Decimal } from '@/lib/money'
import { byType } from '@/lib/sales-types'
import type { SalesDocumentDetail } from '@/server/services/sales.service'

const organization = {
  name: 'Blue Plastic',
  legalName: 'Blue Plastic Center',
  addressLine1: 'Bakaara',
  addressLine2: null,
  city: 'Mogadishu',
  region: null,
  postalCode: null,
  country: 'Somalia',
  phone: '+252 61 000 0000',
  email: null,
  taxRegistrationNumber: null,
}

function invoice(id: string, number: string, total: string, paid: string): SalesDocumentDetail {
  return {
    id,
    type: 'INVOICE',
    number,
    date: new Date('2026-03-04T00:00:00Z'),
    dueDate: new Date('2026-04-03T00:00:00Z'),
    expiryDate: null,
    status: 'OPEN',
    reference: null,
    customerMessage: null,
    subtotal: total,
    discountAmount: '0',
    taxTotal: '0',
    total,
    currencyCode: 'USD',
    customer: { id: 'c1', displayName: 'UNION ELECTRONIC MAC', email: null, phone: null, billingLine1: null, billingCity: null },
    lines: [
      {
        id: `${id}-l1`,
        lineNumber: 1,
        description: 'PVC pipe 4"',
        quantity: '10',
        unitPrice: '12.5',
        discountPercent: null,
        amount: total,
        taxAmount: '0',
        item: { id: 'i1', name: 'PVC pipe', sku: 'PVC4' },
      },
    ],
    amountApplied: paid,
    balance: new Decimal(total).minus(paid).toFixed(2),
  } as unknown as SalesDocumentDetail
}

describe('statement opening period', () => {
  it('starts a statement with no period on 1 January of this year, to today', () => {
    const settings = readSettings({}, { timeZone: 'Africa/Mogadishu', fiscalYearStartMonth: 1 }, 'year-to-date')
    const year = settings.range.to.slice(0, 4)
    expect(settings.period).toBe('year-to-date')
    expect(settings.range.from).toBe(`${year}-01-01`)
  })

  it('still honours an explicit All dates', () => {
    const settings = readSettings({ period: 'all-dates' }, { timeZone: 'Africa/Mogadishu', fiscalYearStartMonth: 1 }, 'year-to-date')
    expect(settings.range.from).toBe('1900-01-01')
  })

  it('QuickReport links no longer force All dates', () => {
    expect(customerQuickReportHref('c1')).not.toContain('period=')
    expect(customerQuickReportHref('c1')).not.toContain('view=')
    expect(vendorQuickReportHref('v1')).not.toContain('period=')
    expect(vendorQuickReportHref('v1')).not.toContain('view=')
  })
})

describe('invoice by invoice', () => {
  it('reads the view from the URL and keeps unknown views on the grouped statement', () => {
    expect(readStatementFilter({ view: 'invoices' }).view).toBe('invoices')
    expect(readStatementFilter({ view: 'nonsense' }).view).toBe('regular')
  })

  it('prints only invoices, still narrowed by the balance filter', () => {
    const entry = (kind: StatementKind, open: string) => ({ kind, openAmount: new Decimal(open), dueDate: null })
    const entries = [entry('INVOICE', '5'), entry('PAYMENT', '0'), entry('INVOICE', '0'), entry('CREDIT_MEMO', '3')]
    const all = readStatementFilter({ view: 'invoices', type: 'payment' })
    expect(statementInvoices(entries, all, '2026-10-08')).toHaveLength(2)
    const open = readStatementFilter({ view: 'invoices', status: 'open' })
    expect(statementInvoices(entries, open, '2026-10-08')).toEqual([entries[0]])
  })

  it('offers the invoice papers when asked, including on a vendor statement', () => {
    const props = { view: 'detail' as const, type: 'all', status: 'all' as const, totals: 'line' as const }
    const customer = renderToStaticMarkup(createElement(StatementFilters, { ...props, invoiceView: true }))
    expect(customer).toContain('Invoice by invoice')
    expect(customer).toContain('Invoice summary')
    expect(customer).toContain('Statement')
    const statementAt = customer.indexOf('Grouped — one row')
    const typeAt = customer.indexOf('statement-type')
    const invoiceAt = customer.indexOf('Invoice by invoice')
    expect(statementAt).toBeGreaterThan(-1)
    expect(statementAt).toBeLessThan(typeAt)
    expect(typeAt).toBeLessThan(invoiceAt)
    const vendor = renderToStaticMarkup(createElement(StatementFilters, props))
    expect(vendor).not.toContain('Invoice by invoice')
    expect(vendor).not.toContain('Invoice summary')
    expect(vendor).toContain('Statement')
    expect(vendor.indexOf('Grouped — one row')).toBeLessThan(vendor.indexOf('statement-type'))
    const vendorPapers = renderToStaticMarkup(createElement(StatementFilters, { ...props, invoiceView: true, bills: true }))
    expect(vendorPapers).toContain('Bills')
    expect(vendorPapers).toContain('Bill by bill')
    expect(vendorPapers).toContain('Bill summary')
    expect(vendorPapers).not.toContain('Invoice by invoice')
  })

  it('reads the summary paper on its own', () => {
    expect(readStatementFilter({ view: 'summary' }).view).toBe('summary')
  })

  const paper = {
    organization,
    baseCurrency: 'USD',
    customer: { displayName: 'UNION ELECTRONIC MAC', companyName: null, email: null, address: [] },
    from: '2026-01-01' as const,
    to: '2026-10-08' as const,
    allDates: false,
    caption: '',
    omitted: 0,
    closing: new Decimal('180'),
  }

  it('prints the summary alone, with no invoice pages after it', () => {
    const documents = [invoice('a', 'INV-0001', '125', '25'), invoice('b', 'INV-0002', '80', '0')]
    const html = renderToStaticMarkup(
      createElement(StatementInvoices, { ...paper, documents, part: 'summary' }),
    )
    expect(html).toContain('data-statement-part="summary"')
    expect(html).toContain('Invoice summary')
    expect(html).toContain('>Debit<')
    expect(html).toContain('>Credit<')
    expect(html).toContain('>Balance<')
    expect(html).not.toContain('>Paid<')
    expect(html).not.toContain('data-invoice-page')
    expect(html.match(/class="invoice-sheet /g)).toHaveLength(1)
  })

  it('draws vendor bills in the same invoice colour', () => {
    const documents = [invoice('a', 'BILL-0001', '125', '25')]
    const invoiceHtml = renderToStaticMarkup(
      createElement(StatementInvoices, { ...paper, documents, part: 'summary' }),
    )
    const billHtml = renderToStaticMarkup(
      createElement(StatementInvoices, { ...paper, documents, part: 'summary', subject: 'bill' }),
    )
    expect(invoiceHtml).toContain('#714B67')
    expect(billHtml).toContain('#714B67')
    expect(billHtml).toContain('Bill summary')
    expect(invoiceHtml).toContain('Invoice summary')
  })

  it('prints every invoice on the single-invoice sheet, each on its own page, with no summary', () => {
    const documents = [invoice('a', 'INV-0001', '125', '25'), invoice('b', 'INV-0002', '80', '0')]
    const html = renderToStaticMarkup(
      createElement(StatementInvoices, { ...paper, documents, part: 'invoices' }),
    )
    expect(html).toContain('data-statement-part="invoices"')
    expect(html).not.toContain('Invoice summary')
    expect(html.match(/data-invoice-page/g)).toHaveLength(2)
    // The first invoice is the first page; only the ones after it break.
    expect(html.match(/break-before-page/g)).toHaveLength(1)
    expect(html.match(/class="invoice-sheet /g)).toHaveLength(2)
    expect(html).toContain('INV-0001')
    expect(html).toContain('INV-0002')
    expect(html).toContain('>Item<')
    expect(html).toContain('>Rate<')
    expect(html).toContain('>Debit<')
    expect(html).toContain('>Credit<')
    expect(html).toContain('>Balance<')

    // The print stylesheet hides <header> (the app bar); the sheets must not use one.
    expect(html).not.toContain('<header')

    // Each page is exactly the sheet the single-invoice print page draws.
    for (const document of documents) {
      const sheet = renderToStaticMarkup(
        createElement(InvoiceSheet, {
          document,
          organization,
          config: byType('INVOICE'),
          baseCurrency: 'USD',
          ledger: true,
        }),
      )
      expect(html).toContain(sheet)
    }
  })

  it('carries the customer balance from one invoice onto the next', () => {
    const documents = [
      { ...invoice('a', 'INV-0001', '100', '0'), createdByName: 'Amina Hassan' },
      invoice('b', 'INV-0002', '50', '0'),
    ]
    const html = renderToStaticMarkup(
      createElement(StatementInvoices, {
        ...paper,
        documents,
        part: 'invoices',
        template: DEFAULT_DOCUMENT_TEMPLATE,
        accountAt: {
          a: { previous: '0', current: '100' },
          b: { previous: '100', current: '150' },
        },
      }),
    )
    expect(html).toContain('Amina Hassan')
    expect(html).toContain('Previous balance')
    const previous = html.match(/Previous balance<\/dt><dd class="tabular">([^<]+)/g)
    expect(previous).toEqual([
      'Previous balance</dt><dd class="tabular">$0.00',
      'Previous balance</dt><dd class="tabular">$100.00',
    ])
    const current = html.match(/Current balance<\/dt><dd class="tabular">([^<]+)/g)
    expect(current).toEqual([
      'Current balance</dt><dd class="tabular">$100.00',
      'Current balance</dt><dd class="tabular">$150.00',
    ])
  })
})

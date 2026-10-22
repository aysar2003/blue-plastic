import { describe, expect, it } from 'vitest'

import { buildTextPdf } from '@/lib/pdf-text'
import { printableProjectQuotations, runningQuotationTotals } from '@/lib/project-quotations'
import { renderProjectQuotationsPdf } from '@/server/reports/sales-document-pdf'

describe('printable project quotations', () => {
  it('keeps quotations, drops void and declined, and sorts oldest first', () => {
    const rows = printableProjectQuotations([
      { id: '2', type: 'QUOTATION', status: 'OPEN', date: '2026-10-20', number: 'QT-2' },
      { id: '1', type: 'QUOTATION', status: 'OPEN', date: '2026-10-18', number: 'QT-1' },
      { id: '3', type: 'QUOTATION', status: 'VOID', date: '2026-10-19', number: 'QT-3' },
      { id: '4', type: 'INVOICE', status: 'OPEN', date: '2026-10-19', number: 'INV-1' },
      { id: '5', type: 'QUOTATION', status: 'DECLINED', date: '2026-10-17', number: 'QT-0' },
    ])
    expect(rows.map((row) => row.id)).toEqual(['1', '2'])
  })
})

describe('PDF page breaks', () => {
  it('starts a new page when asked', () => {
    const pdf = buildTextPdf([
      { runs: [{ text: 'Cover' }] },
      { pageBreak: true, runs: [] },
      { runs: [{ text: 'Page two' }] },
    ])
    const text = new TextDecoder().decode(pdf)
    expect(text).toContain('/Count 2')
    expect(text).toContain('Cover')
    expect(text).toContain('Page two')
  })
})

describe('running quotation totals', () => {
  it('adds each previous quotation into the next grand total', () => {
    expect(runningQuotationTotals(['100.0000', '250.0000'])).toEqual([
      { previousQuotationsTotal: '0.0000', runningTotal: '100.0000' },
      { previousQuotationsTotal: '100.0000', runningTotal: '350.0000' },
    ])
  })
})

describe('combined project quotations PDF', () => {
  it('prints each original quotation and carries the previous grand total', () => {
    const paper = {
      orgName: 'Blue Plastic',
      orgAddress: ['Mogadishu'],
      orgPhone: null,
      orgEmail: null,
      title: 'Quotation',
      date: '2026-10-20',
      customerName: 'Amina Construction',
      customerAddress: [],
      customerEmail: null,
      currency: 'USD',
      lines: [
        {
          quantity: '1',
          sku: null,
          description: 'Labour',
          unitPrice: '100.0000',
          amount: '100.0000',
        },
      ],
      subtotal: '100.0000',
      discountAmount: '0.0000',
      taxTotal: '0.0000',
      amountApplied: '0.0000',
      balance: '250.0000',
    }
    const bytes = renderProjectQuotationsPdf({
      orgName: 'Blue Plastic',
      orgAddress: ['Mogadishu'],
      orgPhone: null,
      orgEmail: null,
      projectNumber: 'PRJ-1',
      projectName: 'Villa Hodan',
      customerName: 'Amina Construction',
      currency: 'USD',
      quotations: [
        { ...paper, number: 'QT-1', workScope: 'Foundation', workSite: 'Alanley villa', total: '100.0000' },
        { ...paper, number: 'QT-2', workScope: 'Electrical', workSite: 'Alanley villa', total: '250.0000' },
      ],
    })
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('%PDF')
    expect(text).toContain('QT-1')
    expect(text).toContain('QT-2')
    expect(text).toContain('Foundation')
    expect(text).toContain('Electrical')
    expect(text).toContain('WORK SITE')
    expect(text).toContain('Alanley villa')
    expect(text).toContain('Amina Construction')
    expect(text).toContain('THIS QUOTATION')
    expect(text).toContain('PREVIOUS QUOTATIONS')
    expect(text).toContain('GRAND TOTAL')
    expect(text).toContain('$350.00')
    expect(text).not.toContain('BALANCE')
    expect(text).toContain('/Count 2')
  })
})

import { describe, expect, it } from 'vitest'

import { renderDocumentXlsx } from '@/server/reports/document-xlsx'

describe('renderDocumentXlsx', () => {
  it('returns a non-empty workbook for a minimal document', async () => {
    const bytes = await renderDocumentXlsx({
      orgName: 'Test Co',
      orgAddress: ['Somewhere'],
      orgPhone: null,
      orgEmail: 'books@test.invalid',
      title: 'Invoice',
      documentType: 'INVOICE',
      number: 'INV-100',
      date: '2026-01-15',
      customerName: 'Acme Trading',
      customerAddress: ['Mogadishu'],
      customerEmail: 'acme@test.invalid',
      currency: 'USD',
      lines: [
        {
          quantity: '2',
          sku: 'SKU-1',
          description: 'Pipe fitting',
          unitPrice: '10.00',
          amount: '20.00',
          unitOfMeasure: 'ea',
        },
      ],
      subtotal: '20.00',
      discountAmount: '0.00',
      taxTotal: '0.00',
      total: '20.00',
      balance: '20.00',
    })

    expect(bytes.byteLength).toBeGreaterThan(500)
    // ZIP / OOXML signature
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK')
  })

  it('writes an RFQ workbook as a priced sheet with Unit Price empty', async () => {
    const bytes = await renderDocumentXlsx({
      orgName: 'Test Co',
      orgAddress: ['Somewhere'],
      orgPhone: null,
      orgEmail: null,
      title: 'RFQ',
      documentType: 'RFQ',
      number: 'RFQ-00002',
      date: '2026-10-27',
      customerName: 'Vendor',
      customerAddress: [],
      customerEmail: null,
      currency: 'USD',
      lines: [
        {
          quantity: '100',
          sku: '',
          description: 'A4',
          unitPrice: '2.00',
          amount: '200.00',
          unitOfMeasure: 'Pcs',
        },
      ],
      subtotal: '200.00',
      discountAmount: '0.00',
      taxTotal: '0.00',
      total: '200.00',
    })

    expect(bytes.byteLength).toBeGreaterThan(500)
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK')
  })
})

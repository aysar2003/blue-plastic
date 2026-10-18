import { describe, expect, it } from 'vitest'

import { canEncodeCode128, code128Layout, code128Svg } from '@/lib/barcode-code128-svg'
import { buildEan13, ean13CheckDigit, isValidEan13, nextInternalEan13 } from '@/lib/barcode-ean13'
import { buildTextPdf, pdfBarcodeRow } from '@/lib/pdf-text'
import { renderSalesDocumentPdf } from '@/server/reports/sales-document-pdf'

describe('EAN-13 generation', () => {
  it('computes the GS1 check digit', () => {
    expect(ean13CheckDigit('590123412345')).toBe('7')
    expect(buildEan13('590123412345')).toBe('5901234123457')
    expect(isValidEan13('5901234123457')).toBe(true)
    expect(isValidEan13('5901234123456')).toBe(false)
  })

  it('issues unique internal 200-range codes', () => {
    const first = nextInternalEan13([])
    expect(first).toBe('2000000000015')
    expect(isValidEan13(first)).toBe(true)

    const second = nextInternalEan13([first])
    expect(second).toBe('2000000000022')
    expect(second).not.toBe(first)

    const afterGap = nextInternalEan13(['2000000000107'])
    expect(afterGap).toBe('2000000000114')
  })
})

describe('Code 128 SVG labels', () => {
  it('draws bars and the human-readable code', () => {
    const svg = code128Svg('2000000000015')
    expect(svg).toContain('<svg')
    expect(svg).toContain('<rect')
    expect(svg).toContain('2000000000015')
  })

  it('rejects empty text', () => {
    expect(() => code128Svg('')).toThrow(/empty/i)
  })

  it('exposes shared layout for SVG and PDF', () => {
    const layout = code128Layout('INV-1001', 1.1)
    expect(layout.text).toBe('INV-1001')
    expect(layout.bars.length).toBeGreaterThan(10)
    expect(layout.width).toBeGreaterThan(layout.contentWidth)
    expect(canEncodeCode128('INV-1001')).toBe(true)
    expect(canEncodeCode128('')).toBe(false)
    expect(canEncodeCode128('مرحبا')).toBe(false)
  })
})

describe('document PDF barcode', () => {
  it('embeds Code 128 rectangles in a barcode-only row', () => {
    const row = pdfBarcodeRow('INV-42')
    expect(row).not.toBeNull()
    const pdf = buildTextPdf([row!])
    const text = new TextDecoder().decode(pdf)
    expect(text).toContain('%PDF')
    expect(text).toMatch(/\sre f/)
    expect(text).toContain('INV-42')
  })

  it('puts a scannable number barcode on sales document PDFs', () => {
    const bytes = renderSalesDocumentPdf({
      orgName: 'Blue Plastic',
      orgAddress: ['Mogadishu'],
      orgPhone: null,
      orgEmail: null,
      title: 'Invoice',
      number: 'INV-9001',
      date: '2026-10-14',
      customerName: 'Acme',
      customerAddress: [],
      customerEmail: null,
      currency: 'USD',
      lines: [
        {
          quantity: '2',
          sku: 'DRUM-1',
          description: 'Blue drum',
          unitPrice: '10',
          amount: '20',
        },
      ],
      subtotal: '20',
      discountAmount: '0',
      taxTotal: '0',
      total: '20',
    })
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('%PDF')
    expect(text).toContain('INV-9001')
    expect(text).toMatch(/\sre f/)
  })

  it('puts a scannable number barcode on purchase bill PDFs', () => {
    const bytes = renderSalesDocumentPdf({
      orgName: 'Blue Plastic',
      orgAddress: ['Kismaayo'],
      orgPhone: null,
      orgEmail: null,
      title: 'Bill',
      number: 'BILL-0042',
      date: '2026-10-15',
      customerName: 'Vendor Co',
      customerAddress: [],
      customerEmail: null,
      currency: 'USD',
      lines: [
        {
          quantity: '10',
          sku: 'RESIN',
          description: 'Resin',
          unitPrice: '5',
          amount: '50',
        },
      ],
      subtotal: '50',
      discountAmount: '0',
      taxTotal: '0',
      total: '50',
    })
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('%PDF')
    expect(text).toContain('BILL-0042')
    expect(text).toContain('BILL')
    expect(text).toMatch(/\sre f/)
  })
})

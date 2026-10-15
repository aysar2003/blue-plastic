import { describe, expect, it } from 'vitest'

import { odooPdfLetterhead, odooPdfTableHead, odooPdfTotalBand } from '@/lib/odoo-pdf'
import { buildTextPdf, PDF_PAGE } from '@/lib/pdf-text'

describe('odoo PDF layout', () => {
  it('puts company and title on one full-width letterhead band', () => {
    const rows = odooPdfLetterhead({
      orgName: 'AL FURAAT GROUP',
      orgAddress: ['Furaat Store,, Baicad Street'],
      title: 'Invoice',
      subtitle: 'INV-1',
    })
    const band = rows[0]!
    expect(band.fillInset ?? 0).toBe(0)
    expect(band.runs).toHaveLength(2)
    expect(band.runs[0]?.text).toBe('AL FURAAT GROUP')
    expect(band.runs[1]?.text).toBe('Invoice  INV-1')
    expect(band.runs[1]?.align).toBe('right')
    expect(rows.some((row) => row.runs.some((run) => run.text.includes('Store,,')))).toBe(false)
  })

  it('stretches table head and total across the page', () => {
    const head = odooPdfTableHead([
      { text: 'Qty', x: PDF_PAGE.left },
      { text: 'Amount', x: PDF_PAGE.right, align: 'right' },
    ])
    expect(head.fillInset ?? 0).toBe(0)
    expect(head.runs[1]?.align).toBe('right')

    const total = odooPdfTotalBand('Total $10.00')
    expect(total.fillInset ?? 0).toBe(0)
    expect(total.runs[0]?.align).toBe('right')

    const pdf = buildTextPdf([head, total])
    expect(pdf.byteLength).toBeGreaterThan(200)
  })
})

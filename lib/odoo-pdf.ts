import { ODOO_PDF } from '@/lib/odoo-brand'
import type { PdfRow } from '@/lib/pdf-text'

const WHITE = [1, 1, 1] as const

/**
 * Shared Odoo letterhead for every generated PDF — purple band, company name,
 * optional subtitle, then contact lines on the paper.
 */
export function odooPdfLetterhead(input: {
  orgName: string
  orgAddress?: string[]
  orgPhone?: string | null
  orgEmail?: string | null
  title: string
  subtitle?: string | null
}): PdfRow[] {
  const rows: PdfRow[] = []

  rows.push({
    size: 14,
    height: 28,
    fill: ODOO_PDF.purple,
    fillInset: 0,
    runs: [{ text: input.orgName, x: 40, bold: true, color: WHITE }],
  })
  rows.push({
    size: 11,
    height: 20,
    fill: ODOO_PDF.purple,
    fillInset: 0,
    runs: [{ text: input.title, x: 40, bold: true, color: WHITE }],
  })
  if (input.subtitle) {
    rows.push({
      size: 9,
      height: 16,
      fill: ODOO_PDF.purple,
      fillInset: 0,
      runs: [{ text: input.subtitle, x: 40, color: WHITE }],
    })
  }
  rows.push({ height: 10, runs: [] })

  for (const part of input.orgAddress ?? []) {
    rows.push({
      size: 9,
      height: 12,
      runs: [{ text: part, x: 40, color: ODOO_PDF.muted }],
    })
  }
  if (input.orgPhone) {
    rows.push({
      size: 9,
      height: 12,
      runs: [{ text: `Phone ${input.orgPhone}`, x: 40, color: ODOO_PDF.muted }],
    })
  }
  if (input.orgEmail) {
    rows.push({
      size: 9,
      height: 12,
      runs: [{ text: `Email ${input.orgEmail}`, x: 40, color: ODOO_PDF.muted }],
    })
  }
  if ((input.orgAddress?.length ?? 0) > 0 || input.orgPhone || input.orgEmail) {
    rows.push({ height: 8, runs: [] })
  }

  return rows
}

/** Soft purple table-header row (Odoo list look). */
export function odooPdfTableHead(cells: { text: string; x: number }[]): PdfRow {
  return {
    size: 8,
    height: 16,
    fill: ODOO_PDF.purpleSoft,
    fillInset: 36,
    runs: cells.map((cell) => ({
      text: cell.text,
      x: cell.x,
      bold: true,
      color: ODOO_PDF.purple,
    })),
  }
}

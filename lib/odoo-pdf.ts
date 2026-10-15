import { ODOO_PDF } from '@/lib/odoo-brand'
import { PDF_PAGE, type PdfRow, type PdfRun } from '@/lib/pdf-text'

const WHITE = [1, 1, 1] as const

/**
 * Shared letterhead for every generated PDF — one full-width navy band
 * (company left, title + number right), then readable contact lines.
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
  const rightLabel = [input.title, input.subtitle].filter(Boolean).join('  ')

  rows.push({
    size: 13,
    height: 32,
    fill: ODOO_PDF.purple,
    fillInset: 0,
    runs: [
      { text: input.orgName, x: PDF_PAGE.left, bold: true, color: WHITE },
      {
        text: rightLabel,
        x: PDF_PAGE.right,
        align: 'right',
        bold: true,
        color: WHITE,
      },
    ],
  })
  rows.push({ height: 12, runs: [] })

  for (const part of (input.orgAddress ?? []).map(cleanLine).filter(Boolean)) {
    rows.push({
      size: 9,
      height: 12,
      runs: [{ text: part, x: PDF_PAGE.left, color: ODOO_PDF.contact }],
    })
  }
  if (input.orgPhone) {
    rows.push({
      size: 9,
      height: 12,
      runs: [{ text: `Phone ${input.orgPhone}`, x: PDF_PAGE.left, color: ODOO_PDF.contact }],
    })
  }
  if (input.orgEmail) {
    rows.push({
      size: 9,
      height: 12,
      runs: [{ text: `Email ${input.orgEmail}`, x: PDF_PAGE.left, color: ODOO_PDF.contact }],
    })
  }
  if ((input.orgAddress?.length ?? 0) > 0 || input.orgPhone || input.orgEmail) {
    rows.push({ height: 10, runs: [] })
  }

  return rows
}

/** Soft cyan table-header row — full page width, matching content gutters. */
export function odooPdfTableHead(
  cells: { text: string; x: number; align?: PdfRun['align'] }[],
): PdfRow {
  return {
    size: 8,
    height: 16,
    fill: ODOO_PDF.purpleSoft,
    fillInset: 0,
    runs: cells.map((cell) => ({
      text: cell.text,
      x: cell.x,
      align: cell.align ?? 'left',
      bold: true,
      color: ODOO_PDF.purple,
    })),
  }
}

/** Full-width soft band for Total / summary lines. */
export function odooPdfTotalBand(text: string): PdfRow {
  return {
    size: 11,
    height: 20,
    fill: ODOO_PDF.purpleSoft,
    fillInset: 0,
    runs: [
      {
        text,
        x: PDF_PAGE.right,
        align: 'right',
        bold: true,
        color: ODOO_PDF.purple,
      },
    ],
  }
}

function cleanLine(value: string): string {
  return value
    .trim()
    .replace(/,+/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim()
}

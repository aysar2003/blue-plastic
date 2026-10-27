/**
 * PDF building blocks that match the on-screen MerchantInvoice paper
 * (Settings → Templates accent, banks, terms). Print and PDF stay one paper.
 */

import {
  DEFAULT_DOCUMENT_TEMPLATE,
  DEFAULT_VENDOR_ACCENT,
  type DocumentTemplate,
} from '@/lib/document-template'
import { PDF_PAGE, type PdfRgb, type PdfRow, type PdfRun } from '@/lib/pdf-text'

const WHITE = [1, 1, 1] as const
const INK = [0.12, 0.16, 0.2] as const
const MUTED = [0.36, 0.42, 0.48] as const

export function hexToPdfRgb(hex: string): PdfRgb {
  const raw = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
    return hexToPdfRgb(DEFAULT_DOCUMENT_TEMPLATE.accent)
  }
  return [
    Number.parseInt(raw.slice(0, 2), 16) / 255,
    Number.parseInt(raw.slice(2, 4), 16) / 255,
    Number.parseInt(raw.slice(4, 6), 16) / 255,
  ] as const
}

/** Soft wash for alternating line rows (~16% accent on white). */
export function accentWashRgb(accent: PdfRgb): PdfRgb {
  return [
    accent[0] * 0.16 + 0.84,
    accent[1] * 0.16 + 0.84,
    accent[2] * 0.16 + 0.84,
  ] as const
}

export function merchantAccent(
  template?: DocumentTemplate | null,
  side: 'customer' | 'vendor' = 'customer',
): PdfRgb {
  const hex =
    side === 'vendor'
      ? template?.vendorAccent || DEFAULT_VENDOR_ACCENT
      : template?.accent ?? DEFAULT_DOCUMENT_TEMPLATE.accent
  return hexToPdfRgb(hex)
}

/**
 * Company name left, contact right — same top block as MerchantInvoice print.
 */
export function merchantPdfLetterhead(input: {
  orgName: string
  orgAddress?: string[]
  orgPhone?: string | null
  orgEmail?: string | null
  accent?: PdfRgb
  /** Trade sheet: small company block and a rule, no coloured name. */
  plain?: boolean
}): PdfRow[] {
  if (input.plain) {
    const rows: PdfRow[] = [
      {
        size: 11,
        height: 14,
        runs: [{ text: input.orgName, x: PDF_PAGE.left, bold: true, color: [0.17, 0.44, 0.73] }],
      },
    ]
    const lines = [
      ...(input.orgAddress ?? []).map(cleanLine).filter(Boolean),
      input.orgEmail,
      input.orgPhone,
    ].filter((part): part is string => Boolean(part))
    for (const line of lines) {
      rows.push({ size: 8, height: 11, runs: [{ text: line, color: MUTED }] })
    }
    rows.push({ size: 4, height: 8, runs: [], rule: true })
    return rows
  }
  const accent = input.accent ?? hexToPdfRgb(DEFAULT_DOCUMENT_TEMPLATE.accent)
  const rows: PdfRow[] = []

  rows.push({
    size: 18,
    height: 26,
    runs: [{ text: input.orgName, x: PDF_PAGE.left, bold: true, color: accent }],
  })

  const contact: string[] = []
  if (input.orgPhone) contact.push(`TEL: ${input.orgPhone}`)
  if (input.orgEmail) contact.push(`EMAIL: ${input.orgEmail}`)
  // Screen letterhead is one ADDR line. Callers may pass street, city, and country separately.
  const address = (input.orgAddress ?? []).map(cleanLine).filter(Boolean).join(', ')
  if (address) contact.push(`ADDR: ${address}`)
  for (const line of contact) {
    rows.push({
      size: 8,
      height: 11,
      runs: [{ text: line, x: PDF_PAGE.right, align: 'right', color: MUTED }],
    })
  }
  rows.push({ height: 14, runs: [] })
  return rows
}

export function merchantPdfTableHead(
  cells: { text: string; x: number; align?: PdfRun['align'] }[],
  accent: PdfRgb,
): PdfRow {
  return {
    size: 8,
    height: 16,
    fill: accent,
    fillInset: 0,
    runs: cells.map((cell) => ({
      text: cell.text,
      x: cell.x,
      align: cell.align ?? 'left',
      bold: true,
      color: WHITE,
    })),
  }
}

/** Right-column totals only — same band width as MerchantInvoice print. */
const TOTAL_FROM = 360

export function merchantPdfTotalBand(label: string, value: string, accent: PdfRgb): PdfRow {
  return {
    size: 10,
    height: 16,
    fill: accent,
    fillFrom: TOTAL_FROM,
    fillTo: PDF_PAGE.right + 0,
    // Extend a hair past the content edge so the band meets the page margin look.
    runs: [
      { text: label.toUpperCase(), x: TOTAL_FROM + 8, bold: true, color: WHITE },
      { text: value, x: PDF_PAGE.right, align: 'right', bold: true, color: WHITE },
    ],
  }
}

export function merchantPdfInk(): PdfRgb {
  return INK
}

export function merchantPdfMuted(): PdfRgb {
  return MUTED
}

function cleanLine(value: string): string {
  return value
    .trim()
    .replace(/,+/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim()
}

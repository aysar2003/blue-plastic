import 'server-only'

import { formatDate, formatDateTime, toCalendarDate } from '@/lib/date'
import {
  DEFAULT_DOCUMENT_TEMPLATE,
  type DocumentTemplate,
} from '@/lib/document-template'
import {
  accentWashRgb,
  merchantAccent,
  merchantPdfInk,
  merchantPdfLetterhead,
  merchantPdfMuted,
  merchantPdfTableHead,
} from '@/lib/merchant-pdf'
import { buildTextPdf, pdfBarcodeRow, PDF_PAGE, type PdfRow } from '@/lib/pdf-text'
import type { PrintInk } from '@/lib/print-ink'

export type DeliveryNotePdfInput = {
  orgName: string
  orgAddress: string[]
  orgPhone: string | null
  orgEmail: string | null
  number: string
  date: Date | string
  issuedAt: Date
  timeZone: string
  customerName: string
  shipping: string[]
  customerPhone: string | null
  salesNumber: string
  storeName: string | null
  carrier: string | null
  notes: string | null
  lines: {
    lineNumber: number
    itemName: string | null
    description: string | null
    storeName: string | null
    quantity: string
    ticketNumber: string | null
  }[]
  ink?: PrintInk
  template?: DocumentTemplate | null
}

/**
 * Delivery note PDF — same merchant letterhead / accent / table as invoice Print.
 */
export function renderDeliveryNotePdf(input: DeliveryNotePdfInput): Uint8Array {
  const template = input.template ?? DEFAULT_DOCUMENT_TEMPLATE
  const accent = merchantAccent(template)
  const wash = accentWashRgb(accent)
  const ink = merchantPdfInk()
  const muted = merchantPdfMuted()
  const rows: PdfRow[] = []

  const calendar =
    input.date instanceof Date ? toCalendarDate(input.date) : String(input.date)
  const issued = formatDateTime(input.issuedAt, input.timeZone)

  rows.push(
    ...merchantPdfLetterhead({
      orgName: input.orgName,
      orgAddress: input.orgAddress,
      orgPhone: input.orgPhone,
      orgEmail: input.orgEmail,
      accent,
    }),
  )

  rows.push({
    size: 8,
    height: 12,
    runs: [
      { text: 'DELIVER TO', x: PDF_PAGE.left, bold: true, color: accent },
      { text: 'DELIVERY NOTE', x: PDF_PAGE.right, align: 'right', bold: true, color: accent },
    ],
  })
  rows.push({
    size: 11,
    height: 14,
    runs: [
      { text: input.customerName, x: PDF_PAGE.left, bold: true, color: ink },
      { text: input.number, x: PDF_PAGE.right, align: 'right', bold: true, color: ink },
    ],
  })

  const barcode = pdfBarcodeRow(input.number, { align: 'right', height: 40 })
  if (barcode) rows.push(barcode)

  const leftMeta: { label: string; value: string }[] = [
    ...input.shipping.map((line) => ({ label: 'Address', value: line })),
    { label: 'Phone', value: input.customerPhone?.trim() || '—' },
  ]
  // Collapse repeated Address labels after the first.
  let sawAddress = false
  const meta = leftMeta.flatMap((row) => {
    if (row.label === 'Address') {
      if (sawAddress) return [{ label: '', value: row.value }]
      sawAddress = true
    }
    return [row]
  })

  const rightMeta = [
    { text: `${formatDate(calendar)} · ${issued}`, color: ink },
    { text: `Sale ${input.salesNumber}`, color: ink },
    ...(input.storeName ? [{ text: `From store ${input.storeName}`, color: muted }] : []),
    ...(input.carrier ? [{ text: `Carrier ${input.carrier}`, color: ink }] : []),
  ]

  const n = Math.max(meta.length, rightMeta.length)
  for (let i = 0; i < n; i++) {
    const left = meta[i]
    const right = rightMeta[i]
    const runs: { text: string; x: number; align?: 'left' | 'right'; bold?: boolean; color?: readonly [number, number, number] }[] =
      []
    if (left) {
      if (left.label) runs.push({ text: left.label, x: PDF_PAGE.left, color: muted })
      runs.push({ text: left.value.slice(0, 48), x: left.label ? 130 : PDF_PAGE.left, color: ink })
    }
    if (right) {
      runs.push({
        text: right.text,
        x: PDF_PAGE.right,
        align: 'right',
        color: right.color,
      })
    }
    rows.push({ size: 9, height: 12, runs })
  }

  rows.push({ height: 10, runs: [] })
  rows.push(
    merchantPdfTableHead(
      [
        { text: 'No', x: PDF_PAGE.left },
        { text: 'Item / description', x: 70 },
        { text: 'Store', x: 340 },
        { text: 'Qty', x: 450, align: 'right' },
        { text: 'Ticket', x: PDF_PAGE.right, align: 'right' },
      ],
      accent,
    ),
  )

  input.lines.forEach((line, index) => {
    const name = (line.itemName ?? line.description ?? '—').slice(0, 36)
    rows.push({
      size: 9,
      height: 14,
      fill: index % 2 === 1 ? wash : undefined,
      fillInset: 0,
      runs: [
        { text: String(line.lineNumber), x: PDF_PAGE.left, color: ink },
        { text: name, x: 70, color: ink },
        { text: (line.storeName ?? '—').slice(0, 18), x: 340, color: muted },
        { text: line.quantity, x: 450, align: 'right', color: ink },
        { text: line.ticketNumber ?? '—', x: PDF_PAGE.right, align: 'right', color: muted },
      ],
    })
  })

  if (input.notes?.trim() || input.carrier) {
    rows.push({ height: 12, runs: [] })
    rows.push({
      size: 8,
      height: 12,
      runs: [{ text: 'NOTES / INSTRUCTIONS', x: PDF_PAGE.left, bold: true, color: accent }],
    })
    if (input.carrier) {
      rows.push({
        size: 9,
        height: 12,
        runs: [{ text: `Carrier: ${input.carrier}`, x: PDF_PAGE.left, color: ink }],
      })
    }
    if (input.notes?.trim()) {
      for (const part of input.notes.split('\n').map((p) => p.trim()).filter(Boolean)) {
        rows.push({
          size: 9,
          height: 12,
          runs: [{ text: part.slice(0, 90), x: PDF_PAGE.left, color: muted }],
        })
      }
    }
  }

  rows.push({ height: 20, runs: [] })
  rows.push({
    size: 8,
    height: 12,
    runs: [
      { text: 'Dispatched by ________________', x: PDF_PAGE.left, color: muted },
      { text: 'Received by ________________', x: PDF_PAGE.right, align: 'right', color: muted },
    ],
  })
  rows.push({ height: 14, runs: [] })
  rows.push({
    size: 8,
    height: 11,
    runs: [
      {
        text: `This delivery note accompanies goods for sale ${input.salesNumber}. It is not a tax invoice.`,
        x: PDF_PAGE.left,
        color: muted,
      },
    ],
  })

  return buildTextPdf(rows, { ink: input.ink })
}

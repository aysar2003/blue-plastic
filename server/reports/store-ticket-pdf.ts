import 'server-only'

import { formatDate, formatDateTime, toCalendarDate } from '@/lib/date'
import {
  DEFAULT_DOCUMENT_TEMPLATE,
  type DocumentTemplate,
} from '@/lib/document-template'
import {
  merchantAccent,
  merchantPdfInk,
  merchantPdfLetterhead,
  merchantPdfMuted,
} from '@/lib/merchant-pdf'
import { buildTextPdf, pdfBarcodeRow, PDF_PAGE, type PdfRow } from '@/lib/pdf-text'
import type { PrintInk } from '@/lib/print-ink'

export type StoreTicketPdfInput = {
  orgName: string
  orgAddress: string[]
  orgPhone: string | null
  orgEmail: string | null
  number: string
  date: Date | string
  createdAt: Date
  timeZone: string
  originLabel: string
  itemName: string
  quantity: string
  storeName: string
  toStoreName: string | null
  customerName: string | null
  salesNumber: string | null
  deliveryNumber: string | null
  sellerName: string | null
  ink?: PrintInk
  template?: DocumentTemplate | null
}

/** Store ticket PDF — merchant letterhead so it matches the rest of the papers. */
export function renderStoreTicketPdf(input: StoreTicketPdfInput): Uint8Array {
  const template = input.template ?? DEFAULT_DOCUMENT_TEMPLATE
  const trade = template.paperStyle === 'trade'
  const accent = trade ? merchantPdfInk() : merchantAccent(template)
  const ink = merchantPdfInk()
  const muted = merchantPdfMuted()
  const rows: PdfRow[] = []
  const calendar =
    input.date instanceof Date ? toCalendarDate(input.date) : String(input.date)
  const issued = formatDateTime(input.createdAt, input.timeZone)

  rows.push(
    ...merchantPdfLetterhead({
      orgName: input.orgName,
      orgAddress: input.orgAddress,
      orgPhone: input.orgPhone,
      orgEmail: input.orgEmail,
      accent,
      plain: trade,
    }),
  )

  rows.push({
    size: 8,
    height: 12,
    runs: [
      { text: 'STORE TICKET', x: PDF_PAGE.left, bold: true, color: accent },
      { text: input.originLabel.toUpperCase(), x: PDF_PAGE.right, align: 'right', bold: true, color: accent },
    ],
  })
  rows.push({
    size: 14,
    height: 18,
    runs: [{ text: input.number, x: PDF_PAGE.left, bold: true, color: ink }],
  })
  const barcode = pdfBarcodeRow(input.number, { align: 'left', height: 40 })
  if (barcode) rows.push(barcode)

  const fields: { label: string; value: string }[] = [
    { label: 'Item', value: input.itemName },
    { label: 'Qty', value: input.quantity },
    { label: 'From', value: input.storeName },
    ...(input.toStoreName ? [{ label: 'To', value: input.toStoreName }] : []),
    ...(input.customerName ? [{ label: 'Customer', value: input.customerName }] : []),
    ...(input.salesNumber ? [{ label: 'Invoice', value: input.salesNumber }] : []),
    ...(input.deliveryNumber ? [{ label: 'Delivery', value: input.deliveryNumber }] : []),
    ...(input.sellerName ? [{ label: 'Sold by', value: input.sellerName }] : []),
    { label: 'Date', value: `${formatDate(calendar)} · ${issued}` },
  ]

  rows.push({ height: 10, runs: [] })
  for (const row of fields) {
    rows.push({
      size: 10,
      height: 14,
      runs: [
        { text: row.label, x: PDF_PAGE.left, color: muted },
        { text: row.value.slice(0, 55), x: 120, bold: true, color: ink },
      ],
    })
  }

  return buildTextPdf(rows, { ink: input.ink })
}

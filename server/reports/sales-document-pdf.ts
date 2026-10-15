import 'server-only'

import { formatDate, formatTransactionDate, isCalendarDate, toCalendarDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { odooPdfLetterhead, odooPdfTableHead, odooPdfTotalBand } from '@/lib/odoo-pdf'
import { ODOO_PDF } from '@/lib/odoo-brand'
import { buildTextPdf, pdfBarcodeRow, PDF_PAGE, type PdfRow } from '@/lib/pdf-text'
import type { PrintInk } from '@/lib/print-ink'

/** Column edges for the sales line table (full letter width). */
const COL = {
  qty: PDF_PAGE.left,
  item: 80,
  unit: 470,
  amount: PDF_PAGE.right,
} as const

/**
 * Sales document (invoice, quotation, receipt, credit) as an Odoo-styled PDF.
 */
export function renderSalesDocumentPdf(input: {
  orgName: string
  orgAddress: string[]
  orgPhone: string | null
  orgEmail: string | null
  title: string
  number: string
  date: Date | string
  /** Colour or black-and-white paper. */
  ink?: PrintInk
  /** Clock time of the document, when the row stores one. */
  createdAt?: Date | null
  timeZone?: string
  dueDate?: Date | string | null
  customerName: string
  customerAddress: string[]
  customerEmail: string | null
  currency: string
  lines: {
    quantity: string
    sku: string | null
    description: string
    unitPrice: string
    amount: string
  }[]
  subtotal: string
  discountAmount: string
  taxTotal: string
  total: string
  amountApplied?: string
  balance?: string
  message?: string | null
}): Uint8Array {
  const money = (value: string) => formatMoney(value, input.currency)
  const rows: PdfRow[] = []
  const line = (text: string, options: { bold?: boolean; size?: number; height?: number } = {}) => {
    rows.push({
      size: options.size ?? 10,
      height: options.height ?? 14,
      runs: [{ text, x: PDF_PAGE.left, bold: options.bold, color: ODOO_PDF.ink }],
    })
  }

  const calendar =
    typeof input.date === 'string' && isCalendarDate(input.date)
      ? input.date
      : input.date instanceof Date
        ? toCalendarDate(input.date)
        : null
  const date = calendar
    ? formatTransactionDate(calendar, input.createdAt, input.timeZone || 'UTC')
    : String(input.date)
  const due =
    input.dueDate == null
      ? null
      : typeof input.dueDate === 'string'
        ? input.dueDate
        : toCalendarDate(input.dueDate)

  rows.push(
    ...odooPdfLetterhead({
      orgName: input.orgName,
      orgAddress: input.orgAddress,
      orgPhone: input.orgPhone,
      orgEmail: input.orgEmail,
      title: input.title,
      subtitle: input.number,
    }),
  )

  const numberBarcode = pdfBarcodeRow(input.number, { align: 'right', height: 40 })
  if (numberBarcode) rows.push(numberBarcode)

  line(`Date ${date}`, { size: 9, height: 12 })
  if (due) line(`Due ${formatDate(due)}`, { size: 9, height: 14 })

  line('Billed to', { bold: true, size: 9, height: 14 })
  line(input.customerName, { size: 10, height: 13 })
  for (const part of input.customerAddress.map(cleanPart).filter(Boolean)) {
    line(part, { size: 9, height: 12 })
  }
  if (input.customerEmail) line(input.customerEmail, { size: 9, height: 14 })

  rows.push(
    odooPdfTableHead([
      { text: 'Qty', x: COL.qty },
      { text: 'Item', x: COL.item },
      { text: 'Unit', x: COL.unit, align: 'right' },
      { text: 'Amount', x: COL.amount, align: 'right' },
    ]),
  )

  for (const row of input.lines) {
    const item = lineItemLabel(row)
    rows.push({
      size: 9,
      height: 13,
      runs: [
        { text: row.quantity, x: COL.qty, color: ODOO_PDF.ink },
        { text: item.slice(0, 48), x: COL.item, color: ODOO_PDF.ink },
        { text: money(row.unitPrice), x: COL.unit, align: 'right', color: ODOO_PDF.ink },
        { text: money(row.amount), x: COL.amount, align: 'right', color: ODOO_PDF.ink },
      ],
    })
  }

  line('', { height: 10 })
  rows.push({
    size: 9,
    height: 13,
    runs: [
      { text: 'Subtotal', x: COL.unit - 80, color: ODOO_PDF.contact },
      { text: money(input.subtotal), x: COL.amount, align: 'right', color: ODOO_PDF.ink },
    ],
  })
  if (Number(input.discountAmount) > 0) {
    rows.push({
      size: 9,
      height: 13,
      runs: [
        { text: 'Discount', x: COL.unit - 80, color: ODOO_PDF.contact },
        { text: money(input.discountAmount), x: COL.amount, align: 'right', color: ODOO_PDF.ink },
      ],
    })
  }
  if (Number(input.taxTotal) > 0) {
    rows.push({
      size: 9,
      height: 13,
      runs: [
        { text: 'Tax', x: COL.unit - 80, color: ODOO_PDF.contact },
        { text: money(input.taxTotal), x: COL.amount, align: 'right', color: ODOO_PDF.ink },
      ],
    })
  }
  rows.push(odooPdfTotalBand(`Total ${money(input.total)}`))
  if (input.amountApplied && Number(input.amountApplied) > 0) {
    rows.push({
      size: 9,
      height: 13,
      runs: [
        { text: 'Paid', x: COL.unit - 80, color: ODOO_PDF.contact },
        { text: money(input.amountApplied), x: COL.amount, align: 'right', color: ODOO_PDF.ink },
      ],
    })
    if (input.balance) {
      rows.push({
        size: 10,
        height: 15,
        runs: [
          { text: 'Amount due', x: COL.unit - 80, bold: true, color: ODOO_PDF.ink },
          {
            text: money(input.balance),
            x: COL.amount,
            align: 'right',
            bold: true,
            color: ODOO_PDF.ink,
          },
        ],
      })
    }
  }
  if (input.message) {
    line('', { height: 8 })
    line(input.message, { size: 9, height: 14 })
  }

  return buildTextPdf(rows, { ink: input.ink })
}

/** Prefer the description / name; append SKU when it adds information. */
function lineItemLabel(row: { sku: string | null; description: string }): string {
  const name = row.description.trim() || 'Line'
  const sku = row.sku?.trim()
  if (!sku) return name
  if (name.toLowerCase().includes(sku.toLowerCase())) return name
  return `${name} (${sku})`
}

function cleanPart(value: string): string {
  return value
    .trim()
    .replace(/,+/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim()
}

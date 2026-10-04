import 'server-only'

import { formatDate, toCalendarDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { buildTextPdf, type PdfRow } from '@/lib/pdf-text'

/**
 * Sales document (invoice, quotation, receipt, credit) as a plain PDF file.
 */
export function renderSalesDocumentPdf(input: {
  orgName: string
  orgAddress: string[]
  orgPhone: string | null
  orgEmail: string | null
  title: string
  number: string
  date: Date | string
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
      runs: [{ text, x: 40, bold: options.bold }],
    })
  }

  const date =
    typeof input.date === 'string' ? input.date : toCalendarDate(input.date)
  const due =
    input.dueDate == null
      ? null
      : typeof input.dueDate === 'string'
        ? input.dueDate
        : toCalendarDate(input.dueDate)

  line(input.orgName, { bold: true, size: 14, height: 18 })
  for (const part of input.orgAddress) line(part, { size: 9, height: 12 })
  if (input.orgPhone) line(`Phone ${input.orgPhone}`, { size: 9, height: 12 })
  if (input.orgEmail) line(`Email ${input.orgEmail}`, { size: 9, height: 12 })

  line(input.title, { bold: true, size: 12, height: 18 })
  line(input.number, { bold: true, size: 11, height: 14 })
  line(`Date ${formatDate(date)}`, { size: 9, height: 12 })
  if (due) line(`Due ${formatDate(due)}`, { size: 9, height: 14 })

  line('Billed to', { bold: true, size: 9, height: 14 })
  line(input.customerName, { size: 10, height: 13 })
  for (const part of input.customerAddress) line(part, { size: 9, height: 12 })
  if (input.customerEmail) line(input.customerEmail, { size: 9, height: 14 })

  rows.push({
    size: 8,
    height: 14,
    rule: true,
    runs: [
      { text: 'Qty', x: 40, bold: true },
      { text: 'Item', x: 80, bold: true },
      { text: 'Description', x: 160, bold: true },
      { text: 'Unit', x: 400, bold: true },
      { text: 'Amount', x: 480, bold: true },
    ],
  })

  for (const row of input.lines) {
    rows.push({
      size: 8,
      height: 12,
      runs: [
        { text: row.quantity, x: 40 },
        { text: (row.sku ?? '').slice(0, 12), x: 80 },
        { text: row.description.slice(0, 40), x: 160 },
        { text: money(row.unitPrice), x: 400 },
        { text: money(row.amount), x: 480 },
      ],
    })
  }

  line('', { height: 10 })
  line(`Subtotal ${money(input.subtotal)}`, { size: 9, height: 12 })
  if (Number(input.discountAmount) > 0) {
    line(`Discount ${money(input.discountAmount)}`, { size: 9, height: 12 })
  }
  if (Number(input.taxTotal) > 0) {
    line(`Tax ${money(input.taxTotal)}`, { size: 9, height: 12 })
  }
  line(`Total ${money(input.total)}`, { bold: true, size: 11, height: 16 })
  if (input.amountApplied && Number(input.amountApplied) > 0) {
    line(`Paid ${money(input.amountApplied)}`, { size: 9, height: 12 })
    if (input.balance) line(`Amount due ${money(input.balance)}`, { bold: true, size: 10, height: 14 })
  }
  if (input.message) {
    line('', { height: 8 })
    line(input.message, { size: 9, height: 14 })
  }

  return buildTextPdf(rows)
}

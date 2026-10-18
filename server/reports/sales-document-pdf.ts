import 'server-only'

import { formatDate, formatTransactionDate, isCalendarDate, toCalendarDate } from '@/lib/date'
import {
  DEFAULT_DOCUMENT_TEMPLATE,
  type DocumentTemplate,
} from '@/lib/document-template'
import { formatMoney } from '@/lib/money'
import {
  accentWashRgb,
  merchantAccent,
  merchantPdfInk,
  merchantPdfLetterhead,
  merchantPdfMuted,
  merchantPdfTableHead,
  merchantPdfTotalBand,
} from '@/lib/merchant-pdf'
import { buildTextPdf, pdfBarcodeRow, PDF_PAGE, type PdfRow } from '@/lib/pdf-text'
import type { PrintInk } from '@/lib/print-ink'

/** Column edges matching the merchant print sheet (No / Item / Qty / Rate / Amount). */
const COL = {
  no: PDF_PAGE.left,
  item: 70,
  qty: 360,
  rate: 450,
  amount: PDF_PAGE.right,
} as const

/**
 * Sales / purchase document PDF — same paper as browser Print (MerchantInvoice).
 * Accent, banks, and terms come from Settings → Templates.
 */
export function renderSalesDocumentPdf(input: {
  orgName: string
  orgAddress: string[]
  orgPhone: string | null
  orgEmail: string | null
  title: string
  number: string
  date: Date | string
  ink?: PrintInk
  createdAt?: Date | null
  timeZone?: string
  dueDate?: Date | string | null
  customerName: string
  customerAddress: string[]
  customerEmail: string | null
  customerPhone?: string | null
  reference?: string | null
  paymentTerm?: string | null
  status?: string | null
  currency: string
  lines: {
    quantity: string
    sku: string | null
    description: string
    unitPrice: string
    amount: string
    unitOfMeasure?: string | null
  }[]
  subtotal: string
  discountAmount: string
  taxTotal: string
  total: string
  amountApplied?: string
  balance?: string
  message?: string | null
  /** Settings → Templates. Defaults to the merchant teal paper. */
  template?: DocumentTemplate | null
  partyLabel?: string
}): Uint8Array {
  const template = input.template ?? DEFAULT_DOCUMENT_TEMPLATE
  const accent = merchantAccent(template)
  const wash = accentWashRgb(accent)
  const ink = merchantPdfInk()
  const muted = merchantPdfMuted()
  const money = (value: string) => formatMoney(value, input.currency)
  const rows: PdfRow[] = []
  const line = (
    text: string,
    options: { bold?: boolean; size?: number; height?: number; color?: readonly [number, number, number]; x?: number } = {},
  ) => {
    rows.push({
      size: options.size ?? 10,
      height: options.height ?? 14,
      runs: [
        {
          text,
          x: options.x ?? PDF_PAGE.left,
          bold: options.bold,
          color: options.color ?? ink,
        },
      ],
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
    ...merchantPdfLetterhead({
      orgName: input.orgName,
      orgAddress: input.orgAddress,
      orgPhone: input.orgPhone,
      orgEmail: input.orgEmail,
      accent,
    }),
  )

  const party = input.partyLabel ?? 'Bill to'
  line(party.toUpperCase(), { bold: true, size: 8, height: 12, color: accent })
  line(input.customerName, { bold: true, size: 11, height: 14 })
  for (const part of input.customerAddress.map(cleanPart).filter(Boolean)) {
    line(part, { size: 9, height: 12, color: muted })
  }
  if (input.customerPhone) line(`Phone ${input.customerPhone}`, { size: 9, height: 12, color: muted })
  if (input.customerEmail) line(input.customerEmail, { size: 9, height: 12, color: muted })
  if (input.reference) line(`Reference ${input.reference}`, { size: 9, height: 12, color: muted })
  if (input.paymentTerm) line(`Payment ${input.paymentTerm}`, { size: 9, height: 12, color: muted })

  rows.push({ height: 8, runs: [] })
  line(input.title.toUpperCase(), { bold: true, size: 14, height: 18, color: accent })
  line(input.number, { bold: true, size: 11, height: 14 })

  const numberBarcode = pdfBarcodeRow(input.number, { align: 'right', height: 36 })
  if (numberBarcode) rows.push(numberBarcode)

  if (input.status) line(input.status.toUpperCase(), { bold: true, size: 9, height: 14, color: accent })
  line(`Date ${date}`, { size: 9, height: 12 })
  if (due) line(`Due ${formatDate(due)}`, { size: 9, height: 14 })

  rows.push({ height: 8, runs: [] })
  rows.push(
    merchantPdfTableHead(
      [
        { text: 'No', x: COL.no },
        { text: 'Item name', x: COL.item },
        { text: 'Qty', x: COL.qty, align: 'right' },
        { text: 'Rate', x: COL.rate, align: 'right' },
        { text: 'Amount', x: COL.amount, align: 'right' },
      ],
      accent,
    ),
  )

  input.lines.forEach((row, index) => {
    const item = lineItemLabel(row)
    const uom = row.unitOfMeasure?.trim() || 'Pcs'
    rows.push({
      size: 9,
      height: 14,
      fill: index % 2 === 1 ? wash : undefined,
      fillInset: 0,
      runs: [
        { text: String(index + 1), x: COL.no, color: ink },
        { text: item.slice(0, 42), x: COL.item, color: ink },
        {
          text: `${trimNumber(row.quantity)} ${uom}`,
          x: COL.qty,
          align: 'right',
          color: ink,
        },
        { text: money(row.unitPrice), x: COL.rate, align: 'right', color: ink },
        { text: money(row.amount), x: COL.amount, align: 'right', color: ink },
      ],
    })
  })

  rows.push({ height: 12, runs: [] })

  if (template.banks.length > 0) {
    line('BANK DETAILS', { bold: true, size: 8, height: 12, color: accent })
    for (const bank of template.banks) {
      line(`${bank.name}  ${bank.account}`, { size: 9, height: 12 })
    }
    rows.push({ height: 8, runs: [] })
  }

  rows.push(merchantPdfTotalBand('Subtotal', money(input.subtotal), accent))
  if (Number(input.discountAmount) > 0) {
    rows.push(merchantPdfTotalBand('Discount', money(input.discountAmount), accent))
  }
  if (Number(input.taxTotal) > 0) {
    rows.push(merchantPdfTotalBand('Tax', money(input.taxTotal), accent))
  }
  rows.push(merchantPdfTotalBand('Grand total', money(input.total), accent))
  if (input.amountApplied && Number(input.amountApplied) > 0) {
    rows.push(merchantPdfTotalBand('Paid amount', money(input.amountApplied), accent))
    if (input.balance) {
      rows.push(merchantPdfTotalBand('Balance', money(input.balance), accent))
    }
  } else if (input.balance && Number(input.balance) > 0) {
    rows.push(merchantPdfTotalBand('Balance', money(input.balance), accent))
  }

  if (template.terms.trim()) {
    rows.push({ height: 12, runs: [] })
    line('TERMS & CONDITIONS', { bold: true, size: 8, height: 12, color: accent })
    for (const part of template.terms.split('\n').map((part) => part.trim()).filter(Boolean)) {
      line(part, { size: 8, height: 11, color: muted })
    }
  }

  if (input.message) {
    rows.push({ height: 8, runs: [] })
    line(input.message, { size: 9, height: 14 })
  }

  return buildTextPdf(rows, { ink: input.ink })
}

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

function trimNumber(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value
}

import 'server-only'

import { formatDate, formatLongTransactionDate, isCalendarDate, toCalendarDate } from '@/lib/date'
import {
  DEFAULT_DOCUMENT_TEMPLATE,
  type DocumentTemplate,
} from '@/lib/document-template'
import { formatMoney, ZERO } from '@/lib/money'
import { hasPreviousQuotations } from '@/lib/project-quotations'
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
import {
  isProposal,
  paperDateLabel,
  paperShowsMoneyStatus,
  SALES_TYPES,
  STATUS_LABELS,
} from '@/lib/sales-types'
import { PURCHASE_TYPES } from '@/lib/purchase-types'

export type SalesDocumentPdfInput = {
  orgName: string
  orgAddress: string[]
  orgPhone: string | null
  orgEmail: string | null
  title: string
  /** Sales / purchase type — drives date caption and PAID/UNPAID. */
  documentType?: string
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
  /** Nature / section of work on a quotation or estimate. */
  workScope?: string | null
  /** Place the work is done — printed below Sales person on the paper. */
  workSite?: string | null
  /** Sum of earlier project quotations. Grand total then includes this paper. */
  previousQuotationsTotal?: string | null
  /** Project quotation pack: skip customer leftover / paid-balance bands. */
  hideAccountBalance?: boolean
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
  /** Vendor papers use the vendor colour from Settings → Templates. */
  paper?: 'customer' | 'vendor'
  /** Who entered the document — same line as MerchantInvoice print. */
  createdByName?: string | null
  /** Meta field ids hidden via Paper details customize (same as on-screen print). */
  hiddenMeta?: string[] | null
}

/** Column edges matching the merchant print sheet (No / Item / Qty / Rate / Amount). */
const COL = {
  no: PDF_PAGE.left,
  item: 70,
  qty: 360,
  rate: 450,
  amount: PDF_PAGE.right,
} as const

/** Meta grid — label column + value column, same as MerchantInvoice `<dl>`. */
const META = {
  label: PDF_PAGE.left,
  value: 130,
  right: PDF_PAGE.right,
} as const

const WHITE = [1, 1, 1] as const

/**
 * Sales / purchase document PDF — same paper as browser Print (MerchantInvoice).
 * Accent, banks, and terms come from Settings → Templates.
 */
export function renderSalesDocumentPdf(input: SalesDocumentPdfInput): Uint8Array {
  return buildTextPdf(salesDocumentPdfRows(input), { ink: input.ink })
}

function salesDocumentPdfRows(input: SalesDocumentPdfInput): PdfRow[] {
  const template = input.template ?? DEFAULT_DOCUMENT_TEMPLATE
  const accent = merchantAccent(template, input.paper ?? 'customer')
  const wash = accentWashRgb(accent)
  const ink = merchantPdfInk()
  const muted = merchantPdfMuted()
  const money = (value: string) => formatMoney(value, input.currency)
  const rows: PdfRow[] = []
  const foot: PdfRow[] = []
  let target = rows
  const line = (
    text: string,
    options: { bold?: boolean; size?: number; height?: number; color?: readonly [number, number, number]; x?: number } = {},
  ) => {
    target.push({
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
    ? formatLongTransactionDate(calendar, input.createdAt, input.timeZone || 'UTC')
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

  // Draw the same paper as MerchantInvoice print — two columns, badge, long date.
  const party = input.partyLabel ?? 'Bill to'
  const vendorPaper = (input.paper ?? 'customer') === 'vendor' || party.toLowerCase() === 'vendor'
  const docType = input.documentType
  const proposal = isProposal(docType)
  const words = vendorPaper
    ? { reference: 'Vendor ref', date: 'Bill date', person: 'Entered by', order: 'Reference' }
    : {
        reference: 'Cust P.O no',
        date: paperDateLabel(docType),
        person: 'Sales person',
        order: 'Sales order',
      }
  const addressParts = input.customerAddress
    .map(cleanPart)
    .filter(Boolean)
    .filter((part) => part.toLowerCase() !== input.customerName.trim().toLowerCase())
  const addressLine = addressParts.join(', ')
  const status = paperStatusLabel(input.status, input.balance, docType)
  const statusFill =
    status === 'PAID' ? ([0.016, 0.471, 0.341] as const) : status === 'UNPAID' ? ([0.745, 0.071, 0.235] as const) : accent

  rows.push({
    size: 8,
    height: 12,
    runs: [
      { text: party.toUpperCase(), x: META.label, bold: true, color: accent },
      { text: input.title.toUpperCase(), x: META.right, align: 'right', bold: true, color: accent },
    ],
  })
  rows.push({
    size: 11,
    height: 14,
    runs: [
      { text: input.customerName, x: META.label, bold: true, color: ink },
      { text: input.number, x: META.right, align: 'right', bold: true, color: ink },
    ],
  })

  const numberBarcode = pdfBarcodeRow(input.number, { align: 'right', height: 40 })
  if (numberBarcode) rows.push(numberBarcode)

  const hiddenMeta = new Set(input.hiddenMeta ?? [])
  const showMeta = (id: string) => !hiddenMeta.has(id)
  const metaLeft: { label: string; value: string }[] = []
  if (showMeta('reference') && input.reference?.trim()) {
    metaLeft.push({ label: words.reference, value: input.reference.trim() })
  }
  if (showMeta('dueDate') && !proposal && due) {
    metaLeft.push({ label: 'Due date', value: formatDate(due) })
  }
  if (showMeta('payment') && !proposal && input.paymentTerm?.trim()) {
    metaLeft.push({ label: 'Payment', value: input.paymentTerm.trim() })
  }
  if (showMeta('address') && addressLine) metaLeft.push({ label: 'Address', value: addressLine })
  if (showMeta('phone') && input.customerPhone?.trim()) {
    metaLeft.push({ label: 'Phone', value: input.customerPhone.trim() })
  }
  if (showMeta('order') && !proposal && input.reference?.trim()) {
    metaLeft.push({ label: words.order, value: input.reference.trim() })
  }
  if (showMeta('person') && input.createdByName?.trim()) {
    metaLeft.push({ label: words.person, value: input.createdByName.trim() })
  }
  if (showMeta('workSite') && input.workSite?.trim()) {
    metaLeft.push({ label: 'Work site', value: input.workSite.trim() })
  }
  if (showMeta('workScope') && input.workScope?.trim()) {
    metaLeft.push({
      label: 'Work / job',
      value: `${input.workScope.trim()} · Client: ${input.customerName}`,
    })
  }
  if (showMeta('email') && input.customerEmail?.trim()) {
    metaLeft.push({ label: 'Email', value: input.customerEmail.trim() })
  }

  type RightCell = {
    text: string
    bold?: boolean
    color?: readonly [number, number, number]
    badge?: readonly [number, number, number]
  }
  const metaRight: RightCell[] = []
  if (status) metaRight.push({ text: status, bold: true, color: WHITE, badge: statusFill })
  metaRight.push({ text: words.date.toUpperCase(), bold: true, color: accent })
  metaRight.push({ text: date, color: ink })

  const metaRows = Math.max(metaLeft.length, metaRight.length)
  for (let i = 0; i < metaRows; i++) {
    const left = metaLeft[i]
    const right = metaRight[i]
    const runs: {
      text: string
      x: number
      align?: 'left' | 'right'
      bold?: boolean
      color?: readonly [number, number, number]
    }[] = []
    if (left) {
      runs.push({ text: left.label, x: META.label, color: muted })
      runs.push({ text: left.value.slice(0, 42), x: META.value, color: ink })
    }
    if (right) {
      runs.push({
        text: right.text,
        x: META.right,
        align: 'right',
        bold: right.bold,
        color: right.color ?? ink,
      })
    }
    const badgeWidth = right?.badge ? Math.max(52, right.text.length * 7 + 16) : 0
    rows.push({
      size: 9,
      height: 13,
      fill: right?.badge,
      fillFrom: right?.badge ? META.right - badgeWidth : undefined,
      fillTo: right?.badge ? META.right : undefined,
      runs,
    })
  }

  rows.push({ height: 10, runs: [] })
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
    const uom = row.unitOfMeasure?.trim() || 'Pcs' // keep Pcs fallback for blank item unit
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
  target = foot

  if (template.banks.length > 0) {
    line('BANK DETAILS', { bold: true, size: 8, height: 12, color: accent })
    for (const bank of template.banks) {
      line(`${bank.name}  ${bank.account}`, { size: 9, height: 12 })
    }
    foot.push({ height: 8, runs: [] })
  }

  foot.push(merchantPdfTotalBand('Subtotal', money(input.subtotal), accent))
  if (Number(input.discountAmount) > 0) {
    foot.push(merchantPdfTotalBand('Discount', money(input.discountAmount), accent))
  }
  if (Number(input.taxTotal) > 0) {
    foot.push(merchantPdfTotalBand('Tax', money(input.taxTotal), accent))
  }
  if (hasPreviousQuotations(input.previousQuotationsTotal)) {
    const prior = input.previousQuotationsTotal as string
    foot.push(merchantPdfTotalBand('This quotation', money(input.total), accent))
    foot.push(merchantPdfTotalBand('Previous quotations', money(prior), accent))
    foot.push(
      merchantPdfTotalBand('Grand total', money(ZERO.plus(prior).plus(input.total).toFixed(4)), accent),
    )
  } else {
    foot.push(merchantPdfTotalBand('Grand total', money(input.total), accent))
  }
  if (!input.hideAccountBalance) {
    if (input.amountApplied && Number(input.amountApplied) > 0) {
      foot.push(merchantPdfTotalBand('Paid amount', money(input.amountApplied), accent))
    }
    if (input.balance != null && input.balance !== '') {
      foot.push(merchantPdfTotalBand('Balance', money(input.balance), accent))
    }
  }

  if (template.terms.trim()) {
    foot.push({ height: 12, runs: [] })
    line('TERMS & CONDITIONS', { bold: true, size: 8, height: 12, color: accent })
    for (const part of template.terms.split('\n').map((part) => part.trim()).filter(Boolean)) {
      line(part, { size: 8, height: 11, color: muted })
    }
  }

  if (input.message) {
    foot.push({ height: 8, runs: [] })
    line(input.message, { size: 9, height: 14 })
  }

  return [...rows, ...foot]
}

/** A saved sales or purchase paper, ready to draw as PDF. */
export type PackableSheetDocument = {
  type: string
  number: string
  date: Date | string
  createdAt?: Date | null
  dueDate?: Date | string | null
  customer: {
    displayName: string
    billingLine1?: string | null
    billingLine2?: string | null
    billingCity?: string | null
    billingRegion?: string | null
    email?: string | null
    phone?: string | null
  }
  reference?: string | null
  paymentTerm?: { name: string } | null
  workScope?: string | null
  workSite?: string | null
  project?: { siteLocation?: string | null } | null
  status?: string | null
  currencyCode: string
  createdByName?: string | null
  lines: {
    quantity: string
    description?: string | null
    unitPrice: string
    amount: string
    item?: { sku?: string | null; name?: string | null; unitOfMeasure?: string | null } | null
  }[]
  subtotal: string
  discountAmount: string
  taxTotal: string
  total: string
  amountApplied?: string
  balance?: string
  customerMessage?: string | null
}

export function salesDetailToPdfInput(
  document: PackableSheetDocument,
  shared: Pick<SalesDocumentPdfInput, 'ink' | 'template' | 'orgName' | 'orgAddress' | 'orgPhone' | 'orgEmail'> & {
    timeZone?: string | null
  },
  extras: Partial<
    Pick<
      SalesDocumentPdfInput,
      'hideAccountBalance' | 'previousQuotationsTotal' | 'partyLabel' | 'paper' | 'title' | 'hiddenMeta'
    >
  > = {},
): SalesDocumentPdfInput {
  const title = extras.title ?? paperTitle(document.type)
  return {
    ...shared,
    timeZone: shared.timeZone ?? undefined,
    title,
    documentType: document.type,
    hiddenMeta: extras.hiddenMeta,
    number: document.number,
    date: document.date,
    createdAt: document.createdAt,
    dueDate: document.dueDate,
    customerName: document.customer.displayName,
    customerAddress: [
      document.customer.billingLine1,
      document.customer.billingLine2,
      document.customer.billingCity,
      document.customer.billingRegion,
    ].filter((part): part is string => Boolean(part)),
    customerEmail: document.customer.email ?? null,
    customerPhone: document.customer.phone ?? null,
    reference: document.reference,
    paymentTerm: document.paymentTerm?.name ?? null,
    workScope: document.workScope,
    workSite: document.workSite || document.project?.siteLocation || null,
    status: document.status,
    currency: document.currencyCode,
    createdByName: document.createdByName,
    lines: document.lines.map((line) => ({
      quantity: line.quantity,
      sku: line.item?.sku ?? null,
      description: line.description ?? line.item?.name ?? 'Line',
      unitPrice: line.unitPrice,
      amount: line.amount,
      unitOfMeasure: line.item?.unitOfMeasure ?? null,
    })),
    subtotal: document.subtotal,
    discountAmount: document.discountAmount,
    taxTotal: document.taxTotal,
    total: document.total,
    amountApplied: document.amountApplied,
    balance: document.balance,
    message: document.customerMessage,
    hideAccountBalance: extras.hideAccountBalance,
    previousQuotationsTotal: extras.previousQuotationsTotal,
    partyLabel: extras.partyLabel,
    paper: extras.paper,
  }
}

function paperTitle(type: string): string {
  return (
    SALES_TYPES.find((config) => config.type === type)?.singular ??
    PURCHASE_TYPES.find((config) => config.type === type)?.singular ??
    type
  )
}

/**
 * Several original papers in one PDF. Oldest first. Running totals match the
 * project quotation pack when asked for.
 */
export function renderDocumentPackPdf(input: {
  ink?: PrintInk
  documents: SalesDocumentPdfInput[]
  runningTotals?: boolean
}): Uint8Array {
  const rows: PdfRow[] = []
  let previous = ZERO
  input.documents.forEach((document, index) => {
    if (index > 0) rows.push({ pageBreak: true, runs: [] })
    const previousQuotationsTotal = previous.toFixed(4)
    previous = previous.plus(document.total)
    rows.push(
      ...salesDocumentPdfRows({
        ...document,
        hideAccountBalance: input.runningTotals ? true : document.hideAccountBalance,
        previousQuotationsTotal:
          input.runningTotals && hasPreviousQuotations(previousQuotationsTotal)
            ? previousQuotationsTotal
            : document.previousQuotationsTotal,
      }),
    )
  })
  return buildTextPdf(rows, { ink: input.ink })
}

/**
 * One PDF for every quotation on a project — the same paper as a single
 * quotation, oldest first. Later papers add the previous quotations' totals.
 */
export function renderProjectQuotationsPdf(input: {
  ink?: PrintInk
  template?: DocumentTemplate | null
  orgName: string
  orgAddress: string[]
  orgPhone: string | null
  orgEmail: string | null
  projectNumber: string
  projectName: string
  siteLocation?: string | null
  customerName: string
  currency: string
  quotations: SalesDocumentPdfInput[]
}): Uint8Array {
  return renderDocumentPackPdf({
    ink: input.ink,
    runningTotals: true,
    documents: input.quotations,
  })
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
  if (!Number.isFinite(n)) return value
  return n.toFixed(2)
}

/**
 * Match MerchantInvoice: invoices/receipts show PAID/UNPAID; quotations and
 * estimates keep Open / Accepted / Declined — they are not collectible yet.
 */
function paperStatusLabel(
  status: string | null | undefined,
  balance: string | null | undefined,
  documentType?: string | null,
): string {
  if (!status) return ''
  if (!paperShowsMoneyStatus(documentType)) {
    return (STATUS_LABELS[status] ?? status).replaceAll('_', ' ').toUpperCase()
  }
  if (status === 'PAID') return 'PAID'
  const owed = balance != null && Number(balance) > 0.004
  if (owed || status === 'OPEN' || status === 'PARTIAL') return 'UNPAID'
  return (STATUS_LABELS[status] ?? status).replaceAll('_', ' ').toUpperCase()
}

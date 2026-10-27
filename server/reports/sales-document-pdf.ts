import 'server-only'

import { formatDate, formatLongTransactionDate, isCalendarDate, toCalendarDate } from '@/lib/date'
import { documentStampLines } from '@/lib/document-stamp'
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
  /** Who approved the paper, and when. Shown under the lines with status. */
  approvedByName?: string | null
  approvedAt?: Date | string | null
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
  if (template.paperStyle === 'trade') return tradeDocumentPdfRows(input)
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
    if (right?.badge) {
      // Pad the label inside the pill so "OPEN" / "UNPAID" never clip at the edge.
      const padX = 10
      const textW = Math.ceil(right.text.length * 9 * 0.62)
      const badgeWidth = Math.max(58, textW + padX * 2)
      const badgeLeft = META.right - badgeWidth
      runs.push({
        text: right.text,
        x: badgeLeft + padX,
        bold: true,
        color: right.color ?? WHITE,
      })
      rows.push({
        size: 9,
        height: 14,
        fill: right.badge,
        fillFrom: badgeLeft,
        fillTo: META.right,
        runs,
      })
    } else if (right) {
      runs.push({
        text: right.text,
        x: META.right,
        align: 'right',
        bold: right.bold,
        color: right.color ?? ink,
      })
      rows.push({ size: 9, height: 13, runs })
    } else {
      rows.push({ size: 9, height: 13, runs })
    }
  }

  rows.push({ height: 10, runs: [] })
  rows.push(
    merchantPdfTableHead(
      [
        { text: 'No', x: COL.no },
        { text: 'Item name', x: COL.item },
        { text: 'Qty', x: COL.qty, align: 'right' },
        { text: 'Unit', x: COL.qty + 48, align: 'right' },
        { text: 'Rate', x: COL.rate, align: 'right' },
        { text: 'Amount', x: COL.amount, align: 'right' },
      ],
      accent,
    ),
  )

  input.lines.forEach((row, index) => {
    const item = lineItemLabel(row)
    rows.push({
      size: 9,
      height: 14,
      fill: index % 2 === 1 ? wash : undefined,
      fillInset: 0,
      runs: [
        { text: String(index + 1), x: COL.no, color: ink },
        { text: item.slice(0, 42), x: COL.item, color: ink },
        {
          text: `${trimNumber(row.quantity)}`,
          x: COL.qty,
          align: 'right',
          color: ink,
        },
        { text: (row.unitOfMeasure?.trim() || 'EACH').toUpperCase(), x: COL.qty + 48, align: 'right', color: ink },
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

  const totals: typeof foot = []
  totals.push(merchantPdfTotalBand('Subtotal', money(input.subtotal), accent))
  if (Number(input.discountAmount) > 0) {
    totals.push(merchantPdfTotalBand('Discount', money(input.discountAmount), accent))
  }
  if (Number(input.taxTotal) > 0) {
    totals.push(merchantPdfTotalBand('Tax', money(input.taxTotal), accent))
  }
  if (hasPreviousQuotations(input.previousQuotationsTotal)) {
    const prior = input.previousQuotationsTotal as string
    totals.push(merchantPdfTotalBand('This quotation', money(input.total), accent))
    totals.push(merchantPdfTotalBand('Previous quotations', money(prior), accent))
    totals.push(
      merchantPdfTotalBand('Grand total', money(ZERO.plus(prior).plus(input.total).toFixed(4)), accent),
    )
  } else {
    totals.push(merchantPdfTotalBand('Grand total', money(input.total), accent))
  }
  if (!input.hideAccountBalance) {
    if (input.amountApplied && Number(input.amountApplied) > 0) {
      totals.push(merchantPdfTotalBand('Paid amount', money(input.amountApplied), accent))
    }
    if (input.balance != null && input.balance !== '') {
      totals.push(merchantPdfTotalBand('Balance', money(input.balance), accent))
    }
  }
  // Keep Subtotal → Grand total / Balance on one page (no orphaned last band).
  for (const row of totals) foot.push({ ...row, keepId: 'paper-totals' })

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

  foot.push({ height: 8, runs: [] })
  for (const text of stampPdfLines(input)) {
    line(text, { size: 9, height: 13, color: muted })
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
  approvedByName?: string | null
  approvedAt?: Date | string | null
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
    approvedByName: document.approvedByName,
    approvedAt: document.approvedAt,
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

function stampPdfLines(input: SalesDocumentPdfInput): string[] {
  return documentStampLines({
    createdBy: input.createdByName,
    approvedBy: input.approvedByName,
    approvedAt: input.approvedAt,
    status: input.status,
  })
}

/** Same Trade sheet as on-screen print: ship-to, order facts, six line columns. */
function tradeDocumentPdfRows(input: SalesDocumentPdfInput): PdfRow[] {
  const muted = merchantPdfMuted()
  const money = (value: string) => formatMoney(value, input.currency)
  const rows: PdfRow[] = []
  const purchase = (input.partyLabel ?? '').toLowerCase() === 'vendor'
  const title = `${input.title} #${input.number}`
  const calendar =
    typeof input.date === 'string' && isCalendarDate(input.date)
      ? input.date
      : input.date instanceof Date
        ? toCalendarDate(input.date)
        : null
  const date = calendar
    ? formatLongTransactionDate(calendar, input.createdAt, input.timeZone || 'UTC')
    : String(input.date)
  const accent = merchantAccent(input.template, purchase ? 'vendor' : 'customer')
  const party = (input.partyLabel ?? (purchase ? 'Vendor' : 'Bill to')).toUpperCase()
  const docTitle = input.title.toUpperCase()
  const status = (STATUS_LABELS[input.status ?? ''] ?? input.status ?? '').replaceAll('_', ' ').toUpperCase()
  const addressLine = input.customerAddress.map(cleanPart).filter(Boolean).join(', ')

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
      { text: party, bold: true, color: accent },
      { text: docTitle, x: PDF_PAGE.right, align: 'right', bold: true, color: accent },
    ],
  })
  rows.push({
    size: 11,
    height: 14,
    runs: [
      { text: input.customerName, bold: true },
      { text: input.number, x: PDF_PAGE.right, align: 'right', bold: true },
    ],
  })
  if (addressLine) {
    rows.push({
      size: 9,
      height: 12,
      runs: [
        { text: 'Address', color: muted },
        { text: addressLine.slice(0, 48), x: 90 },
      ],
    })
  }
  const numberBarcode = pdfBarcodeRow(input.number, { align: 'right', height: 36 })
  if (numberBarcode) rows.push(numberBarcode)
  if (status) {
    rows.push({
      size: 8,
      height: 14,
      runs: [{ text: status, x: PDF_PAGE.right, align: 'right', bold: true, color: accent }],
    })
  }
  rows.push({
    size: 8,
    height: 12,
    runs: [
      { text: paperDateLabel(input.documentType).toUpperCase(), x: PDF_PAGE.right, align: 'right', bold: true, color: accent },
    ],
  })
  rows.push({
    size: 9,
    height: 13,
    runs: [{ text: date, x: PDF_PAGE.right, align: 'right' }],
  })

  rows.push({ size: 18, height: 28, runs: [{ text: title }] })
  rows.push({
    size: 8,
    height: 12,
    runs: [
      { text: purchase ? 'Purchase Representative:' : 'Sales person:', bold: true },
      { text: purchase ? 'Your Order Reference:' : 'Reference:', x: 220, bold: true },
      { text: 'Order Date:', x: 400, bold: true },
    ],
  })
  rows.push({
    size: 9,
    height: 14,
    runs: [
      { text: input.createdByName?.trim() || '—' },
      { text: input.reference?.trim() || '—', x: 220 },
      { text: date, x: 400 },
    ],
  })
  const remarks = input.message?.trim() || (input.template ?? DEFAULT_DOCUMENT_TEMPLATE).terms.trim() || '—'
  rows.push({
    size: 9,
    height: 14,
    runs: [
      { text: 'Remarks:', bold: true },
      { text: ` ${remarks.slice(0, 180)}` },
    ],
  })

  const taxX = 250
  const dateX = 330
  const qtyX = 420
  const rateX = 490
  const amountX = PDF_PAGE.right
  rows.push({
    size: 8,
    height: 14,
    runs: [
      { text: 'Description', bold: true },
      { text: 'Taxes', x: taxX, align: 'right', bold: true },
      { text: 'Date req.', x: dateX, align: 'right', bold: true },
      { text: 'Qty', x: qtyX, align: 'right', bold: true },
      { text: 'Unit', x: qtyX + 42, align: 'right', bold: true },
      { text: 'Unit price', x: rateX, align: 'right', bold: true },
      { text: 'Amount', x: amountX, align: 'right', bold: true },
    ],
    rule: true,
  })
  input.lines.forEach((line, index) => {
    const qty = Number.isFinite(Number(line.quantity)) ? Number(line.quantity).toFixed(3) : line.quantity
    const unit = line.unitOfMeasure?.trim() || 'EACH'
    rows.push({
      size: 8,
      height: 14,
      fill: index % 2 === 1 ? [0.953, 0.957, 0.965] : undefined,
      fillInset: PDF_PAGE.left,
      runs: [
        { text: (line.description || line.sku || '').slice(0, 36) },
        { text: '', x: taxX, align: 'right' },
        { text: date, x: dateX, align: 'right' },
        { text: qty, x: qtyX, align: 'right' },
        { text: unit.toUpperCase(), x: qtyX + 42, align: 'right' },
        {
          text: Number.isFinite(Number(line.unitPrice)) ? Number(line.unitPrice).toFixed(3) : line.unitPrice,
          x: rateX,
          align: 'right',
        },
        { text: money(line.amount), x: amountX, align: 'right' },
      ],
    })
  })

  const stamp = stampPdfLines(input)
  rows.push({ size: 6, height: 10, runs: [] })
  rows.push({
    size: 9,
    height: 13,
    keepId: 'trade-totals',
    runs: [
      { text: stamp[0] ?? '', color: muted },
      { text: 'Subtotal', x: 430 },
      { text: money(input.subtotal), x: amountX, align: 'right' },
    ],
  })
  rows.push({
    size: 9,
    height: 13,
    keepId: 'trade-totals',
    runs: [
      { text: stamp[1] ?? '', color: muted },
      {
        text: purchase
          ? input.documentType === 'PURCHASE_ORDER'
            ? 'Bill payment'
            : 'Taxes'
          : 'Payment',
        x: 430,
      },
      {
        text:
          purchase && input.documentType !== 'PURCHASE_ORDER'
            ? money(input.taxTotal)
            : money(input.amountApplied || '0'),
        x: amountX,
        align: 'right',
      },
    ],
  })
  rows.push({
    size: 9,
    height: 13,
    keepId: 'trade-totals',
    runs: [
      { text: stamp[2] ?? '', color: muted },
    ],
  })
  rows.push({
    size: 9,
    height: 13,
    keepId: 'trade-totals',
    runs: [
      { text: stamp[3] ?? '', color: muted },
    ],
  })
  rows.push({
    size: 10,
    height: 16,
    keepId: 'trade-totals',
    rule: true,
    runs: [
      { text: 'Total', x: 430, bold: true },
      { text: money(input.total), x: amountX, align: 'right', bold: true },
    ],
  })
  const foot = [input.orgEmail, input.orgPhone].filter(Boolean).join('  |  ')
  if (foot) {
    rows.push({ size: 8, height: 14, runs: [{ text: foot, x: 306, align: 'center', color: muted }], rule: true })
  }
  return rows
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

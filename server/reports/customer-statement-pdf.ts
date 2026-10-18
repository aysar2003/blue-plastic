import 'server-only'

import { formatDate, toCalendarDate } from '@/lib/date'
import {
  STATEMENT_VIEW_LABELS,
  signedOpen,
  statementFilterCaption,
  type StatementFilter,
} from '@/lib/customer-statement'
import {
  DEFAULT_DOCUMENT_TEMPLATE,
  type DocumentTemplate,
} from '@/lib/document-template'
import { Decimal, formatMoney } from '@/lib/money'
import {
  merchantAccent,
  merchantPdfInk,
  merchantPdfLetterhead,
  merchantPdfMuted,
  merchantPdfTableHead,
  merchantPdfTotalBand,
} from '@/lib/merchant-pdf'
import { buildTextPdf, PDF_PAGE, type PdfRow } from '@/lib/pdf-text'
import type { PrintInk } from '@/lib/print-ink'
import type { StatementEntry } from '@/server/services/receivables.service'

export type StatementPdfInput = {
  orgName: string
  orgAddress: string[]
  orgPhone: string | null
  orgEmail: string | null
  customerName: string
  address: string[]
  email: string | null
  currency: string
  from: string
  to: string
  opening: string
  charges: string
  credits: string
  closing: string
  filter: StatementFilter
  ledger: boolean
  entries: StatementEntry[]
  ink?: PrintInk
  template?: DocumentTemplate | null
}

/**
 * Statement PDF — same merchant letterhead / accent as invoice Print + PDF.
 */
export function renderCustomerStatementPdf(input: StatementPdfInput): Uint8Array {
  const template = input.template ?? DEFAULT_DOCUMENT_TEMPLATE
  const accent = merchantAccent(template)
  const inkColor = merchantPdfInk()
  const muted = merchantPdfMuted()
  const money = (value: Decimal.Value) => formatMoney(value, input.currency)
  const rows: PdfRow[] = []
  const line = (
    text: string,
    options: { bold?: boolean; size?: number; height?: number; x?: number; color?: readonly [number, number, number] } = {},
  ) => {
    rows.push({
      size: options.size ?? 10,
      height: options.height ?? 14,
      runs: [
        {
          text,
          x: options.x ?? PDF_PAGE.left,
          bold: options.bold,
          color: options.color ?? inkColor,
        },
      ],
    })
  }

  rows.push(
    ...merchantPdfLetterhead({
      orgName: input.orgName,
      orgAddress: input.orgAddress,
      orgPhone: input.orgPhone,
      orgEmail: input.orgEmail,
      accent,
    }),
  )

  line('CUSTOMER STATEMENT', { bold: true, size: 14, height: 18, color: accent })
  line(input.customerName, { bold: true, size: 11, height: 14 })

  for (const part of input.address) line(part, { size: 9, height: 12, color: muted })
  if (input.email) line(input.email, { size: 9, height: 12, color: muted })
  line(`${formatDate(input.from)} to ${formatDate(input.to)}`, { size: 9, height: 16 })
  line(STATEMENT_VIEW_LABELS[input.filter.view], { size: 9, height: 12 })
  const caption = statementFilterCaption(input.filter)
  if (caption) line(caption, { size: 8, height: 14, color: muted })

  line(
    `Opening ${input.opening}    Debit ${input.charges}    Credit ${input.credits}    Amount due ${input.closing}`,
    { bold: true, size: 9, height: 20 },
  )

  const head = [
    'Date',
    'Document',
    'Description',
    'Due',
    'Debit',
    'Credit',
    input.ledger ? 'Balance' : 'Balance due',
  ]
  const cols: { x: number; align?: 'left' | 'right' }[] = [
    { x: PDF_PAGE.left },
    { x: 95 },
    { x: 165 },
    { x: 300 },
    { x: 400, align: 'right' },
    { x: 480, align: 'right' },
    { x: PDF_PAGE.right, align: 'right' },
  ]
  rows.push(
    merchantPdfTableHead(
      head.map((label, index) => ({
        text: label,
        x: cols[index]!.x,
        align: cols[index]!.align,
      })),
      accent,
    ),
  )

  if (input.ledger) {
    rows.push(amountRow(['', '', 'Balance brought forward', '', '', '', input.opening], cols, true, inkColor))
  }

  for (const entry of input.entries) {
    const due = entry.dueDate ? formatDate(toCalendarDate(entry.dueDate)) : ''
    const cells = [
      formatDate(toCalendarDate(entry.date)),
      entry.number,
      clip(entry.description, 24),
      due,
      entry.charge.isZero() ? '' : money(entry.charge),
      entry.credit.isZero() ? '' : money(entry.credit),
      money(input.ledger ? entry.balance : signedOpen(entry)),
    ]
    rows.push(amountRow(cells, cols, false, inkColor))

    if (input.filter.view === 'detail' && entry.lines.length > 0) {
      rows.push({
        size: 8,
        height: 12,
        runs: [
          { text: 'Name', x: 110, bold: true, color: accent },
          { text: 'Qty', x: 360, bold: true, color: accent },
          { text: 'Price', x: 450, align: 'right', bold: true, color: accent },
          { text: 'Amount', x: PDF_PAGE.right, align: 'right', bold: true, color: accent },
        ],
      })
      for (const item of entry.lines) {
        rows.push({
          size: 8,
          height: 12,
          runs: [
            { text: clip(item.description, 42), x: 110, color: inkColor },
            { text: item.quantity ? plainQty(item.quantity) : '', x: 360, color: inkColor },
            {
              text: item.rate ? money(item.rate) : '',
              x: 450,
              align: 'right',
              color: inkColor,
            },
            { text: money(item.amount), x: PDF_PAGE.right, align: 'right', color: inkColor },
          ],
        })
      }
    }
  }

  rows.push(
    merchantPdfTotalBand(
      input.ledger ? 'Amount due' : 'Rows shown',
      input.ledger ? input.closing : String(input.entries.length),
      accent,
    ),
  )

  return buildTextPdf(rows, { ink: input.ink })
}

function amountRow(
  cells: string[],
  cols: { x: number; align?: 'left' | 'right' }[],
  bold: boolean,
  color: readonly [number, number, number],
): PdfRow {
  return {
    size: 8,
    height: 13,
    runs: cells.map((text, index) => ({
      text,
      x: cols[index]!.x,
      align: cols[index]!.align,
      bold,
      color,
    })),
  }
}

function clip(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`
}

function plainQty(value: Decimal.Value): string {
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : String(value)
}

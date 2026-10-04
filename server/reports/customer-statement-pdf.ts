import 'server-only'

import { formatDate, toCalendarDate } from '@/lib/date'
import {
  STATEMENT_VIEW_LABELS,
  statementFilterCaption,
  type StatementFilter,
} from '@/lib/customer-statement'
import { Decimal, formatMoney } from '@/lib/money'
import { buildTextPdf, type PdfRow } from '@/lib/pdf-text'
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
}

/**
 * The statement as a PDF file, the same rows the screen is showing.
 */
export function renderCustomerStatementPdf(input: StatementPdfInput): Uint8Array {
  const money = (value: Decimal.Value) => formatMoney(value, input.currency)
  const rows: PdfRow[] = []
  const line = (text: string, options: { bold?: boolean; size?: number; height?: number; x?: number } = {}) => {
    rows.push({
      size: options.size ?? 10,
      height: options.height ?? 14,
      runs: [{ text, x: options.x ?? 40, bold: options.bold }],
    })
  }

  line(input.orgName, { bold: true, size: 14, height: 18 })
  for (const part of input.orgAddress) line(part, { size: 9, height: 12 })
  if (input.orgPhone) line(`Phone ${input.orgPhone}`, { size: 9, height: 12 })
  if (input.orgEmail) line(`Email ${input.orgEmail}`, { size: 9, height: 12 })
  line('Customer statement', { bold: true, size: 12, height: 16 })
  line(input.customerName, { bold: true })
  for (const part of input.address) line(part, { size: 9, height: 12 })
  if (input.email) line(input.email, { size: 9, height: 12 })
  line(`${formatDate(input.from)} to ${formatDate(input.to)}`, { size: 9, height: 16 })
  line(STATEMENT_VIEW_LABELS[input.filter.view], { size: 9, height: 12 })
  const caption = statementFilterCaption(input.filter)
  if (caption) line(caption, { size: 8, height: 14 })

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
  const xs = [40, 95, 165, 300, 370, 440, 510]
  rows.push({
    size: 8,
    height: 16,
    rule: true,
    runs: head.map((label, index) => ({ text: label, x: xs[index]!, bold: true })),
  })

  if (input.ledger) {
    rows.push(amountRow(['', '', 'Balance brought forward', '', '', '', input.opening], xs, true))
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
      money(input.ledger ? entry.balance : entry.openAmount),
    ]
    rows.push(amountRow(cells, xs, false))

    if (input.filter.view === 'detail' && entry.lines.length > 0) {
      rows.push({
        size: 8,
        height: 12,
        runs: [
          { text: 'Name', x: 110, bold: true },
          { text: 'Qty', x: 320, bold: true },
          { text: 'Price', x: 370, bold: true },
          { text: 'Amount', x: 450, bold: true },
        ],
      })
      for (const item of entry.lines) {
        rows.push({
          size: 8,
          height: 12,
          runs: [
            { text: clip(item.description, 42), x: 110 },
            { text: item.quantity ? plainQty(item.quantity) : '', x: 320 },
            { text: item.rate ? money(item.rate) : '', x: 370 },
            { text: money(item.amount), x: 450 },
          ],
        })
      }
    }
  }

  line(input.ledger ? `Amount due ${input.closing}` : `Rows shown ${input.entries.length}`, {
    bold: true,
    size: 10,
    height: 22,
  })

  return buildTextPdf(rows)
}

function amountRow(cells: string[], xs: number[], bold: boolean): PdfRow {
  return {
    size: 8,
    height: 13,
    runs: cells.map((text, index) => ({ text, x: xs[index]!, bold })),
  }
}

function clip(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value
}

function plainQty(value: string): string {
  const amount = new Decimal(value)
  return amount.mod(1).isZero() ? amount.toFixed(0) : amount.toFixed(2)
}

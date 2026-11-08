import 'server-only'

import type { JournalSourceType } from '@prisma/client'

import { JOURNAL_SOURCE_LABELS } from '@/lib/accounting-labels'
import { MONTHS } from '@/lib/constants'
import { formatDate, formatTransactionDate, toCalendarDate } from '@/lib/date'
import { letterheadOf, type LetterheadSource } from '@/lib/letterhead'
import { formatMoney } from '@/lib/money'
import { ODOO_PDF } from '@/lib/odoo-brand'
import { buildTextPdf, type PdfRow } from '@/lib/pdf-text'
import type { PrintInk } from '@/lib/print-ink'
import type { JournalRow } from '@/server/services/journal.service'

const PDF_WIDTH = 792
const PDF_HEIGHT = 612
const COLUMNS = [36, 100, 168, 330, 430, 520, 690]

export type MonthExport = {
  org: LetterheadSource & { tradingName?: string | null }
  label: string
  from: string
  to: string
  currency: string
  timeZone?: string
  income: string | null
  expenses: string | null
  net: string | null
  rows: JournalRow[]
  ink?: PrintInk
}

export function monthTitle(periodNumber: number, start: Date) {
  if (periodNumber === 0) return 'Opening balances'
  return `${MONTHS[(start.getUTCMonth() + 12) % 12]} ${start.getUTCFullYear()}`
}

/** Company name, then the rest of the letterhead, each line meant to sit in the centre. */
export function companyHeader(org: LetterheadSource & { tradingName?: string | null }) {
  const block = letterheadOf(org)
  const lines = [block.name]
  const trading = org.tradingName?.trim()
  if (trading && trading !== block.name) lines.push(trading)
  if (block.address) lines.push(block.address)
  if (block.phone) lines.push(block.phone)
  if (block.email) lines.push(block.email)
  return lines
}

export function renderMonthPdf(input: MonthExport): Uint8Array {
  const money = (value: string) => formatMoney(value, input.currency)
  const header: PdfRow[] = []
  const centre = (text: string, options: { bold?: boolean; size?: number; height?: number } = {}) => {
    header.push({
      size: options.size ?? 10,
      height: options.height ?? 13,
      runs: [{ text, align: 'center', bold: options.bold }],
    })
  }

  const [name, ...rest] = companyHeader(input.org)
  header.push({
    size: 14,
    height: 26,
    fill: ODOO_PDF.purple,
    fillInset: 0,
    runs: [{ text: name ?? input.org.name, align: 'center', bold: true, color: [1, 1, 1] }],
  })
  for (const line of rest) {
    header.push({
      size: 9,
      height: 12,
      fill: ODOO_PDF.purple,
      fillInset: 0,
      runs: [{ text: line, align: 'center', color: [1, 1, 1] }],
    })
  }
  header.push({
    size: 12,
    height: 20,
    fill: ODOO_PDF.purple,
    fillInset: 0,
    runs: [{ text: input.label, align: 'center', bold: true, color: [1, 1, 1] }],
  })
  header.push({
    size: 9,
    height: 14,
    fill: ODOO_PDF.purple,
    fillInset: 0,
    runs: [
      {
        text: `${formatDate(input.from)} to ${formatDate(input.to)}`,
        align: 'center',
        color: [1, 1, 1],
      },
    ],
  })
  if (input.income && input.expenses && input.net) {
    centre(`Income ${input.income}    Expenses ${input.expenses}    Net income ${input.net}`, {
      bold: true,
      size: 9,
      height: 16,
    })
  }
  header.push({ height: 6, runs: [] })
  header.push({
    size: 8,
    height: 14,
    fill: ODOO_PDF.purpleSoft,
    fillInset: 24,
    runs: ['Entry', 'Date', 'Description', 'Source', 'Document', 'Customer / vendor', 'Amount'].map(
      (label, index) => ({
        text: label,
        x: COLUMNS[index],
        bold: true,
        color: ODOO_PDF.purple,
      }),
    ),
  })

  const body: PdfRow[] = input.rows.map((journal) => ({
    size: 8,
    height: 13,
    runs: [
      journal.journalNumber,
      formatTransactionDate(toCalendarDate(journal.date), journal.postedAt, input.timeZone || 'UTC'),
      clip(journal.memo ?? '', 28),
      JOURNAL_SOURCE_LABELS[journal.sourceType as JournalSourceType] ?? journal.sourceType,
      journal.source.number ?? '',
      clip(journal.source.partyName ?? '', 22),
      money(journal.total),
    ].map((text, index) => ({ text, x: COLUMNS[index] })),
  }))

  if (body.length === 0) {
    body.push({ size: 9, height: 16, runs: [{ text: 'Nothing posted in this month.', x: 36 }] })
  }

  return buildTextPdf(body, { width: PDF_WIDTH, height: PDF_HEIGHT, header, ink: input.ink })
}

export async function renderMonthWorkbook(input: MonthExport): Promise<Uint8Array> {
  const { renderListXlsx } = await import('@/server/reports/list-xlsx')
  const summary =
    input.income && input.expenses && input.net
      ? `Income ${input.income} · Expenses ${input.expenses} · Net ${input.net}`
      : undefined
  const range = `${formatDate(input.from)} to ${formatDate(input.to)}`
  return renderListXlsx({
    org: input.org,
    title: input.label,
    subtitle: summary ? `${range}  ·  ${summary}` : range,
    currency: input.currency,
    sheetName: input.label.slice(0, 31),
    columns: [
      { header: 'Entry', width: 16, kind: 'text' },
      { header: 'Date', width: 14, kind: 'text' },
      { header: 'Description', width: 42, kind: 'text' },
      { header: 'Source', width: 22, kind: 'text' },
      { header: 'Document', width: 16, kind: 'text' },
      { header: 'Customer / vendor', width: 28, kind: 'text' },
      { header: 'Amount', width: 14, kind: 'money' },
    ],
    rows: input.rows.map((journal) => [
      journal.journalNumber,
      formatTransactionDate(toCalendarDate(journal.date), journal.postedAt, input.timeZone || 'UTC'),
      journal.memo ?? '',
      JOURNAL_SOURCE_LABELS[journal.sourceType as JournalSourceType] ?? journal.sourceType,
      journal.source.number ?? '',
      journal.source.partyName ?? '',
      journal.total,
    ]),
  })
}

function clip(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value
}

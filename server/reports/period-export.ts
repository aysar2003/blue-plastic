import 'server-only'

import type { JournalSourceType } from '@prisma/client'

import { JOURNAL_SOURCE_LABELS } from '@/lib/accounting-labels'
import { MONTHS } from '@/lib/constants'
import { formatDate, toCalendarDate } from '@/lib/date'
import { letterheadOf, type LetterheadSource } from '@/lib/letterhead'
import { formatMoney } from '@/lib/money'
import { ODOO_PDF } from '@/lib/odoo-brand'
import { buildTextPdf, type PdfRow } from '@/lib/pdf-text'
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
  income: string | null
  expenses: string | null
  net: string | null
  rows: JournalRow[]
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
      formatDate(toCalendarDate(journal.date)),
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

  return buildTextPdf(body, { width: PDF_WIDTH, height: PDF_HEIGHT, header })
}

export async function renderMonthWorkbook(input: MonthExport): Promise<Uint8Array> {
  const loaded = (await import('exceljs')) as unknown as {
    Workbook?: new () => {
      addWorksheet: (name: string) => ExcelSheet
      xlsx: { writeBuffer: () => Promise<ArrayBuffer> }
    }
    default?: {
      Workbook: new () => {
        addWorksheet: (name: string) => ExcelSheet
        xlsx: { writeBuffer: () => Promise<ArrayBuffer> }
      }
    }
  }
  const Workbook = loaded.Workbook ?? loaded.default?.Workbook
  if (!Workbook) throw new Error('The Excel writer did not load')

  const workbook = new Workbook()
  const sheet = workbook.addWorksheet(input.label.slice(0, 31))
  sheet.columns = [
    { width: 16 },
    { width: 14 },
    { width: 42 },
    { width: 22 },
    { width: 16 },
    { width: 28 },
    { width: 16 },
  ]

  const lines = companyHeader(input.org)
  let row = 1
  for (const [index, line] of lines.entries()) {
    sheet.mergeCells(row, 1, row, 7)
    const cell = sheet.getCell(row, 1)
    cell.value = line
    cell.alignment = { horizontal: 'center' }
    cell.font = index === 0 ? { bold: true, size: 16 } : { size: 11 }
    row += 1
  }
  row += 1
  sheet.mergeCells(row, 1, row, 7)
  sheet.getCell(row, 1).value = input.label
  sheet.getCell(row, 1).alignment = { horizontal: 'center' }
  sheet.getCell(row, 1).font = { bold: true, size: 14 }
  row += 1
  sheet.mergeCells(row, 1, row, 7)
  sheet.getCell(row, 1).value = `${formatDate(input.from)} to ${formatDate(input.to)}`
  sheet.getCell(row, 1).alignment = { horizontal: 'center' }
  row += 1
  if (input.income && input.expenses && input.net) {
    sheet.mergeCells(row, 1, row, 7)
    sheet.getCell(row, 1).value = `Income ${input.income}    Expenses ${input.expenses}    Net income ${input.net}`
    sheet.getCell(row, 1).alignment = { horizontal: 'center' }
    sheet.getCell(row, 1).font = { bold: true }
    row += 1
  }
  row += 1

  const head = sheet.getRow(row)
  writeCells(head, ['Entry', 'Date', 'Description', 'Source', 'Document', 'Customer / vendor', 'Amount'])
  head.font = { bold: true }
  const headerRow = row
  row += 1

  for (const journal of input.rows) {
    const line = sheet.getRow(row)
    writeCells(line, [
      journal.journalNumber,
      formatDate(toCalendarDate(journal.date)),
      journal.memo ?? '',
      JOURNAL_SOURCE_LABELS[journal.sourceType as JournalSourceType] ?? journal.sourceType,
      journal.source.number ?? '',
      journal.source.partyName ?? '',
      Number(journal.total),
    ])
    line.getCell(7).numFmt = '#,##0.00'
    row += 1
  }

  sheet.views = [{ state: 'frozen', ySplit: headerRow }]
  sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: Math.max(headerRow, row - 1), column: 7 } }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}

function writeCells(line: { getCell: (col: number) => { value?: string | number; numFmt: string } }, values: (string | number)[]) {
  values.forEach((value, index) => {
    line.getCell(index + 1).value = value
  })
}

function clip(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value
}

type ExcelSheet = {
  columns: { width: number }[]
  mergeCells: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void
  getCell: (row: number, col: number) => { value: string; alignment: { horizontal: string }; font: { bold?: boolean; size?: number } }
  getRow: (row: number) => { font: { bold?: boolean }; getCell: (col: number) => { value?: string | number; numFmt: string } }
  views: { state: string; ySplit: number }[]
  autoFilter: { from: { row: number; column: number }; to: { row: number; column: number } }
}

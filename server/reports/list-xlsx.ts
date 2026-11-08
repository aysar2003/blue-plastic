import 'server-only'

import type { Borders, Cell, Fill, Font, Workbook as ExcelWorkbook, Worksheet } from 'exceljs'

import { letterheadOf, type LetterheadSource } from '@/lib/letterhead'
import { Decimal, toMoneyString } from '@/lib/money'
import type { CsvCell } from '@/server/reports/csv'

async function loadWorkbookCtor() {
  const loaded = (await import('exceljs')) as unknown as {
    Workbook?: new () => ExcelWorkbook
    default?: { Workbook: new () => ExcelWorkbook }
  }
  const Workbook = loaded.Workbook ?? loaded.default?.Workbook
  if (!Workbook) throw new Error('The Excel writer did not load')
  return Workbook
}

/** Shared professional report colours (teal company band + slate body). */
export const XLSX_LOOK = {
  brand: 'FF0B4F6C',
  brandSoft: 'FFE8F1F5',
  ink: 'FF0F172A',
  muted: 'FF64748B',
  line: 'FFCBD5E1',
  grid: 'FFE2E8F0',
  stripe: 'FFF8FAFC',
  white: 'FFFFFFFF',
  font: 'Calibri',
} as const

export type ListXlsxColumn = {
  header: string
  /** Approximate character width for the column. */
  width?: number
  kind?: 'text' | 'money' | 'date' | 'number'
}

export type ListXlsxSheet = {
  name: string
  title?: string
  subtitle?: string
  columns: ListXlsxColumn[]
  rows: CsvCell[][]
}

/**
 * A list export as a real `.xlsx`: centered company letterhead, report title,
 * complete columns (delete any you do not need), currency-marked money ($),
 * and print titles so the letterhead repeats on every printed page.
 */
export async function renderListXlsx(input: {
  org: LetterheadSource
  title: string
  /** Optional second line under the title (date range, as-of, party name). */
  subtitle?: string
  currency?: string
  exportedAt?: string
  sheetName?: string
  columns: ListXlsxColumn[]
  rows: CsvCell[][]
}): Promise<Uint8Array> {
  return renderMultiSheetXlsx({
    org: input.org,
    title: input.title,
    subtitle: input.subtitle,
    currency: input.currency,
    exportedAt: input.exportedAt,
    sheets: [
      {
        name: input.sheetName ?? input.title,
        title: input.title,
        subtitle: input.subtitle,
        columns: input.columns,
        rows: input.rows,
      },
    ],
  })
}

/**
 * Multi-sheet workbook (close packs, report packs). Letterhead on every sheet.
 */
export async function renderMultiSheetXlsx(input: {
  org: LetterheadSource
  title: string
  subtitle?: string
  currency?: string
  exportedAt?: string
  sheets: ListXlsxSheet[]
}): Promise<Uint8Array> {
  const Workbook = await loadWorkbookCtor()
  const workbook = new Workbook()
  workbook.creator = 'SOM ERP'
  workbook.company = letterheadOf(input.org).name || 'SOM ERP'
  workbook.created = new Date()
  workbook.modified = new Date()

  const usedNames = new Set<string>()
  for (const sheetInput of input.sheets) {
    const sheet = workbook.addWorksheet(uniqueSheetName(sheetInput.name, usedNames), {
      properties: { defaultRowHeight: 18 },
      views: [{ showGridLines: false }],
    })
    fillSheet(sheet, {
      org: input.org,
      title: sheetInput.title ?? input.title,
      subtitle: sheetInput.subtitle ?? input.subtitle,
      currency: input.currency,
      exportedAt: input.exportedAt,
      columns: sheetInput.columns,
      rows: sheetInput.rows,
    })
  }

  if (workbook.worksheets.length === 0) {
    const sheet = workbook.addWorksheet('Export', {
      properties: { defaultRowHeight: 18 },
      views: [{ showGridLines: false }],
    })
    fillSheet(sheet, {
      org: input.org,
      title: input.title,
      subtitle: input.subtitle,
      currency: input.currency,
      exportedAt: input.exportedAt,
      columns: [{ header: 'Note', width: 40 }],
      rows: [['No data']],
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayBuffer)
}

function uniqueSheetName(raw: string, used: Set<string>): string {
  let base = (raw.trim() || 'Sheet').slice(0, 31)
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  for (let i = 2; i < 100; i++) {
    const suffix = ` (${i})`
    const name = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`
    if (!used.has(name)) {
      used.add(name)
      return name
    }
  }
  const fallback = `Sheet${used.size + 1}`.slice(0, 31)
  used.add(fallback)
  return fallback
}

function solid(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function thin(argb: string): Partial<Borders> {
  return {
    top: { style: 'thin', color: { argb } },
    left: { style: 'thin', color: { argb } },
    bottom: { style: 'thin', color: { argb } },
    right: { style: 'thin', color: { argb } },
  }
}

function font(partial: Partial<Font> = {}): Partial<Font> {
  return { name: XLSX_LOOK.font, size: 11, ...partial }
}

/**
 * Company band + contact lines. Returns the next free row index.
 * Safe for import sheets: letterhead stays above the real column headers.
 */
export function paintCompanyBand(
  sheet: Worksheet,
  org: LetterheadSource,
  colCount: number,
  startRow = 1,
): number {
  const block = letterheadOf(org)
  let row = startRow
  const span = Math.max(colCount, 1)

  const brand = sheet.getCell(row, 1)
  brand.value = block.name || 'Company'
  brand.font = font({ bold: true, size: 16, color: { argb: XLSX_LOOK.white } })
  brand.fill = solid(XLSX_LOOK.brand)
  brand.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  if (span > 1) sheet.mergeCells(row, 1, row, span)
  for (let c = 2; c <= span; c++) {
    sheet.getCell(row, c).fill = solid(XLSX_LOOK.brand)
  }
  sheet.getRow(row).height = 28
  row += 1

  const contactBits = [
    block.address,
    block.phone ? `Phone ${block.phone}` : '',
    block.email ? `Email ${block.email}` : '',
  ].filter(Boolean)
  if (contactBits.length > 0) {
    const contact = sheet.getCell(row, 1)
    contact.value = contactBits.join('  ·  ')
    contact.font = font({ size: 9, color: { argb: XLSX_LOOK.muted } })
    contact.fill = solid(XLSX_LOOK.brandSoft)
    contact.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    if (span > 1) sheet.mergeCells(row, 1, row, span)
    for (let c = 2; c <= span; c++) {
      sheet.getCell(row, c).fill = solid(XLSX_LOOK.brandSoft)
    }
    sheet.getRow(row).height = 20
    row += 1
  }

  return row + 1
}

function fillSheet(
  sheet: Worksheet,
  input: {
    org: LetterheadSource
    title: string
    subtitle?: string
    currency?: string
    exportedAt?: string
    columns: ListXlsxColumn[]
    rows: CsvCell[][]
  },
) {
  const colCount = Math.max(input.columns.length, 1)
  const currencyCode = (input.currency || '').trim().toUpperCase() || undefined
  let row = paintCompanyBand(sheet, input.org, colCount)

  const titleCell = sheet.getCell(row, 1)
  titleCell.value = input.title
  titleCell.font = font({ bold: true, size: 14, color: { argb: XLSX_LOOK.ink } })
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  if (colCount > 1) sheet.mergeCells(row, 1, row, colCount)
  sheet.getRow(row).height = 22
  row += 1

  if (input.subtitle?.trim()) {
    const subtitleCell = sheet.getCell(row, 1)
    subtitleCell.value = input.subtitle.trim()
    subtitleCell.font = font({ size: 10, color: { argb: XLSX_LOOK.muted } })
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    if (colCount > 1) sheet.mergeCells(row, 1, row, colCount)
    row += 1
  }

  const meta: string[] = []
  if (currencyCode) meta.push(`Currency: ${currencyCode}`)
  if (input.exportedAt) meta.push(`Exported ${input.exportedAt}`)
  else meta.push(`Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`)
  const metaCell = sheet.getCell(row, 1)
  metaCell.value = meta.join('  ·  ')
  metaCell.font = font({ size: 9, color: { argb: XLSX_LOOK.muted } })
  metaCell.alignment = { vertical: 'middle', horizontal: 'center' }
  if (colCount > 1) sheet.mergeCells(row, 1, row, colCount)
  row += 1

  // Accent rule under the report head.
  const rule = sheet.getCell(row, 1)
  rule.fill = solid(XLSX_LOOK.brand)
  if (colCount > 1) sheet.mergeCells(row, 1, row, colCount)
  for (let c = 2; c <= colCount; c++) sheet.getCell(row, c).fill = solid(XLSX_LOOK.brand)
  sheet.getRow(row).height = 3
  row += 2

  const headerRowIndex = row
  for (let c = 0; c < input.columns.length; c++) {
    const column = input.columns[c]
    const cell = sheet.getCell(headerRowIndex, c + 1)
    cell.value = moneyHeaderLabel(column.header, column.kind, currencyCode)
    cell.font = font({ bold: true, size: 10, color: { argb: XLSX_LOOK.white } })
    cell.fill = solid(XLSX_LOOK.brand)
    cell.alignment = {
      vertical: 'middle',
      horizontal: column.kind === 'money' || column.kind === 'number' ? 'right' : 'left',
      wrapText: false,
      indent: 1,
    }
    cell.border = thin(XLSX_LOOK.brand)
  }
  sheet.getRow(headerRowIndex).height = 24
  row += 1

  const firstDataRow = row
  for (let r = 0; r < input.rows.length; r++) {
    const data = input.rows[r] ?? []
    const excelRow = firstDataRow + r
    const stripe = r % 2 === 1
    sheet.getRow(excelRow).height = 20
    for (let c = 0; c < input.columns.length; c++) {
      const column = input.columns[c]
      const cell = sheet.getCell(excelRow, c + 1)
      // Always write every column cell so values never shift sideways.
      writeCell(cell, data[c] ?? '', column.kind ?? 'text', currencyCode)
      if (stripe) cell.fill = solid(XLSX_LOOK.stripe)
      cell.border = thin(XLSX_LOOK.grid)
      cell.font = font({
        size: 10,
        color: { argb: XLSX_LOOK.ink },
        ...(cell.font ?? {}),
      })
      const horizontal =
        column.kind === 'money' || column.kind === 'number'
          ? 'right'
          : column.kind === 'date'
            ? 'center'
            : 'left'
      cell.alignment = {
        vertical: 'middle',
        horizontal,
        wrapText: false,
        indent: horizontal === 'left' ? 1 : 0,
      }
    }
  }

  const lastDataRow = input.rows.length > 0 ? firstDataRow + input.rows.length - 1 : headerRowIndex
  row = lastDataRow + 2

  const footBits = ['Prepared with SOM ERP']
  if (currencyCode) footBits.push(`Amounts in ${currencyCode}`)
  const foot = sheet.getCell(row, 1)
  foot.value = footBits.join('  ·  ')
  foot.font = font({ size: 8, italic: true, color: { argb: XLSX_LOOK.muted } })
  foot.alignment = { vertical: 'middle', horizontal: 'center' }
  if (colCount > 1) sheet.mergeCells(row, 1, row, colCount)

  for (let c = 0; c < input.columns.length; c++) {
    const column = input.columns[c]
    const excelColumn = sheet.getColumn(c + 1)
    const labeled = moneyHeaderLabel(column.header, column.kind, currencyCode)
    const base =
      column.width ??
      Math.min(42, Math.max(column.kind === 'money' ? 16 : 12, labeled.length + 3))
    excelColumn.width = base
  }

  // No freeze: header scrolls with the sheet. Filter + print titles still work.
  sheet.views = [{ showGridLines: false }]
  if (input.rows.length > 0) {
    sheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: lastDataRow, column: colCount },
    }
  }

  const companyName = letterheadOf(input.org).name || 'Company'
  applyPrintChrome(sheet, {
    companyName,
    title: input.title,
    headerRowIndex,
    colCount,
    currency: currencyCode,
  })
}

/**
 * Print chrome: letterhead through column headers on every page, landscape when
 * wide, page numbers, and currency called out in the footer.
 */
export function applyPrintChrome(
  sheet: Worksheet,
  input: {
    companyName: string
    title: string
    headerRowIndex: number
    colCount: number
    currency?: string
  },
) {
  const safeCompany = sanitizePrintText(input.companyName)
  const safeTitle = sanitizePrintText(input.title)
  const currencyNote = input.currency ? `  ·  Amounts in ${sanitizePrintText(input.currency)}` : ''
  sheet.pageSetup = {
    ...(sheet.pageSetup ?? {}),
    orientation: input.colCount > 6 ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    horizontalCentered: true,
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.6,
      bottom: 0.6,
      header: 0.25,
      footer: 0.35,
    },
    // Company band + title + column headers on every printed page.
    printTitlesRow: `1:${input.headerRowIndex}`,
  }
  sheet.headerFooter = {
    differentFirst: false,
    oddHeader: `&C&B${safeCompany}`,
    evenHeader: `&C&B${safeCompany}`,
    oddFooter: `&LPrepared with SOM ERP${currencyNote}&C${safeTitle}&RPage &P of &N`,
    evenFooter: `&LPrepared with SOM ERP${currencyNote}&C${safeTitle}&RPage &P of &N`,
  }
}

function sanitizePrintText(value: string): string {
  return value.replace(/[&]/g, '').trim().slice(0, 80)
}

/** Mark money column headers with the currency code when not already present. */
export function moneyHeaderLabel(
  header: string,
  kind: ListXlsxColumn['kind'] | undefined,
  currency?: string,
): string {
  if (kind !== 'money' || !currency) return header
  if (/\([A-Z]{3}\)/.test(header) || header.includes(currency)) return header
  return `${header} (${currency})`
}

/** Excel number format so amounts read clearly as dollars (or other currency). */
export function moneyNumFmt(currency?: string): string {
  const code = (currency || 'USD').toUpperCase()
  const byCode: Record<string, string> = {
    USD: '"$"#,##0.00;[Red]("$"#,##0.00)',
    EUR: '"€"#,##0.00;[Red]("€"#,##0.00)',
    GBP: '"£"#,##0.00;[Red]("£"#,##0.00)',
    KES: '"KSh "#,##0.00;[Red]("KSh "#,##0.00)',
    SOS: '"SOS "#,##0.00;[Red]("SOS "#,##0.00)',
    AED: '"AED "#,##0.00;[Red]("AED "#,##0.00)',
    SAR: '"SAR "#,##0.00;[Red]("SAR "#,##0.00)',
  }
  return byCode[code] ?? `"${code} "#,##0.00;[Red]("${code} "#,##0.00)`
}

function writeCell(
  cell: Cell,
  value: CsvCell,
  kind: NonNullable<ListXlsxColumn['kind']>,
  currency?: string,
) {
  if (value === null || value === undefined || value === '') {
    cell.value = ''
    return
  }

  if (kind === 'money') {
    const amount = parseMoney(value)
    if (amount !== null) {
      cell.value = amount
      cell.numFmt = moneyNumFmt(currency)
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
      return
    }
  }

  if (kind === 'number') {
    const amount =
      value instanceof Decimal
        ? Number(value.toString())
        : typeof value === 'number'
          ? value
          : Number(String(value).replace(/,/g, ''))
    if (Number.isFinite(amount)) {
      cell.value = amount
      cell.numFmt = '#,##0.####'
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
      return
    }
  }

  if (kind === 'date') {
    const parsed = parseIsoDate(value)
    if (parsed) {
      cell.value = parsed
      cell.numFmt = 'yyyy-mm-dd'
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      return
    }
  }

  // Phones, codes, names: always text so Excel never uses scientific notation.
  const text = value instanceof Decimal ? toMoneyString(value, 2) : String(value)
  cell.value = text
  cell.numFmt = '@'
  cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
}

function parseMoney(value: CsvCell): number | null {
  if (value instanceof Decimal) return Number(toMoneyString(value, 2))
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const cleaned = String(value).replace(/,/g, '').replace(/\s/g, '').trim()
  if (!cleaned) return null
  const amount = Number(cleaned)
  return Number.isFinite(amount) ? amount : null
}

function parseIsoDate(value: CsvCell): Date | null {
  const text = String(value).trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return new Date(Date.UTC(year, month - 1, day))
}

export const PACK_XLSX_PREFIX = 'XLSX1:'

export function encodePackXlsxBody(bytes: Uint8Array): string {
  return `${PACK_XLSX_PREFIX}${Buffer.from(bytes).toString('base64')}`
}

export function decodePackXlsxBody(body: string): Uint8Array | null {
  if (!body.startsWith(PACK_XLSX_PREFIX)) return null
  return new Uint8Array(Buffer.from(body.slice(PACK_XLSX_PREFIX.length), 'base64'))
}

export function xlsxResponse(filename: string, body: Uint8Array): Response {
  const safe = filename.replace(/\.csv$/i, '.xlsx').replace(/[^\w.\-]+/g, '_')
  return new Response(Buffer.from(body), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safe.endsWith('.xlsx') ? safe : `${safe}.xlsx`}"`,
      'Cache-Control': 'no-store',
    },
  })
}

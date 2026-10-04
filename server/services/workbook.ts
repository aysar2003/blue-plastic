import 'server-only'

import type { Workbook as ExcelWorkbook } from 'exceljs'

/**
 * The first sheet of an Excel file, as text cells.
 *
 * QuickBooks Online's Export button writes .xlsx, not CSV. Dates stay as the
 * calendar day in the cell, and money stays as the number Excel stored, so the
 * importer sees the same values a person sees when they open the file.
 */
export async function workbookRecords(base64: string): Promise<string[][]> {
  const loaded = (await import('exceljs')) as unknown as {
    Workbook?: new () => ExcelWorkbook
    default?: { Workbook: new () => ExcelWorkbook }
  }
  const Workbook = loaded.Workbook ?? loaded.default?.Workbook
  if (!Workbook) throw new Error('The Excel reader did not load')

  const workbook = new Workbook()
  const buffer = Buffer.from(base64, 'base64')
  await workbook.xlsx.load(buffer as unknown as Parameters<ExcelWorkbook['xlsx']['load']>[0])

  // The blank template keeps instructions and dropdown lists on other sheets.
  // The sheet a person fills is the first one that is not one of those.
  const sheet =
    workbook.worksheets.find((candidate) => candidate.name !== 'How to fill' && candidate.name !== 'Lists') ??
    workbook.worksheets[0]
  if (!sheet) return []

  const records: string[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = []
    const values = row.values
    if (!Array.isArray(values)) return
    for (let index = 1; index < values.length; index++) {
      cells.push(cellText(values[index]))
    }
    records.push(cells)
  })
  return records
}

function cellText(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) return calendarDay(value)
  if (typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const cell = value as { text?: string; result?: unknown; richText?: { text: string }[] }
    if (typeof cell.text === 'string') return cell.text
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text).join('')
    if (cell.result != null) return cellText(cell.result)
  }
  return String(value).trim()
}

/**
 * Excel stores a date as a calendar day. The reader turns that into a Date at
 * UTC midnight, which is the previous evening in time zones west of Greenwich.
 * A midnight in UTC is that calendar day; any other time is a local date.
 */
function calendarDay(value: Date): string {
  const utcMidnight =
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  const year = utcMidnight ? value.getUTCFullYear() : value.getFullYear()
  const month = (utcMidnight ? value.getUTCMonth() : value.getMonth()) + 1
  const day = utcMidnight ? value.getUTCDate() : value.getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

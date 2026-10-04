/**
 * A small, strict CSV reader.
 *
 * Deliberately not a dependency: the job is to read a file a person exported from
 * a spreadsheet, and the whole surface is quoted fields, escaped quotes, embedded
 * newlines and a possible BOM. Anything a full parser adds beyond that would be
 * behaviour nobody asked for on a file nobody can re-check.
 */
export type CsvRow = Record<string, string>

export function parseCsv(input: string): { headers: string[]; rows: CsvRow[] } {
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const records: string[][] = []

  let field = ''
  let record: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      record.push(field)
      field = ''
    } else if (char === '\n') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else {
      field += char
    }
  }

  if (field !== '' || record.length > 0) {
    record.push(field)
    records.push(record)
  }

  const nonEmpty = records.filter((r) => r.some((cell) => cell.trim() !== ''))
  return parseTable(nonEmpty)
}

/**
 * Turn a grid of cells into rows keyed by header.
 *
 * A report export (QuickBooks does this) puts the company name and the report
 * title in the rows above the columns. Those rows are a single cell. The header
 * is the first row with two or more filled cells. A file that is already a
 * plain list starts on that row, so nothing about it changes.
 */
export function parseTable(records: string[][]): { headers: string[]; rows: CsvRow[] } {
  const nonEmpty = records.filter((r) => r.some((cell) => cell.trim() !== ''))
  if (nonEmpty.length === 0) return { headers: [], rows: [] }

  const wide = nonEmpty.findIndex((record) => record.filter((cell) => cell.trim() !== '').length >= 2)
  const headerAt = wide === -1 ? 0 : wide

  const headers = nonEmpty[headerAt].map((h) => normaliseHeader(h))

  const rows = nonEmpty.slice(headerAt + 1).map((cells) => {
    const row: CsvRow = {}
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim()
    })
    return row
  })

  return { headers, rows }
}

/**
 * Match headers the way a person would: case, spaces and punctuation are noise.
 * "Display Name", "display_name", "DisplayName" and "Product/Service Name" agree.
 */
export function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

export type ImportIssue = { row: number; field?: string; message: string }

export type ImportOutcome<T> = {
  valid: { row: number; data: T }[]
  issues: ImportIssue[]
  total: number
}

/** Read the first present alias, so a file does not have to use our exact wording. */
export function pick(row: CsvRow, ...aliases: string[]): string {
  for (const alias of aliases) {
    const value = row[normaliseHeader(alias)]
    if (value !== undefined && value !== '') return value
  }
  return ''
}

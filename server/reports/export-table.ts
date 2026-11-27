import 'server-only'

import type { LetterheadSource } from '@/lib/letterhead'
import { csvResponse, toCsv, type CsvCell } from '@/server/reports/csv'
import {
  renderListXlsx,
  renderMultiSheetXlsx,
  xlsxResponse,
  type ListXlsxColumn,
  type ListXlsxSheet,
} from '@/server/reports/list-xlsx'

/**
 * Modern ERP export contract (Odoo / DualEntry / DayZero style):
 * one column model → prepared Excel (letterhead, typed cells) and CSV
 * (UTF-8 BOM, human headers). Never camelCase field names for staff downloads.
 */
export type ExportColumn = ListXlsxColumn

export type ExportTable = {
  columns: ExportColumn[]
  rows: CsvCell[][]
}

export function exportTableHeaders(table: ExportTable): string[] {
  return table.columns.map((column) => column.header)
}

export function exportTableToCsv(table: ExportTable): string {
  return toCsv([[...exportTableHeaders(table)], ...table.rows])
}

export function exportTableCsvResponse(filename: string, table: ExportTable): Response {
  return csvResponse(filename.replace(/\.xlsx$/i, '.csv'), [
    [...exportTableHeaders(table)],
    ...table.rows,
  ])
}

export async function exportTableToXlsx(input: {
  org: LetterheadSource
  title: string
  subtitle?: string
  currency?: string
  sheetName?: string
  table: ExportTable
}): Promise<Uint8Array> {
  return renderListXlsx({
    org: input.org,
    title: input.title,
    subtitle: input.subtitle,
    currency: input.currency,
    sheetName: input.sheetName ?? input.title,
    columns: input.table.columns,
    rows: input.table.rows,
  })
}

export function exportTableXlsxResponse(filename: string, body: Uint8Array): Response {
  return xlsxResponse(filename.replace(/\.csv$/i, '.xlsx'), body)
}

export async function exportPackToXlsx(input: {
  org: LetterheadSource
  title: string
  subtitle?: string
  currency?: string
  sheets: ListXlsxSheet[]
}): Promise<Uint8Array> {
  return renderMultiSheetXlsx(input)
}

/** Cover / parameters sheet used by modern financial workbooks. */
export function coverParametersSheet(input: {
  title: string
  rows: Array<[string, string]>
}): ListXlsxSheet {
  return {
    name: 'Cover',
    title: input.title,
    subtitle: 'Export parameters',
    columns: [
      { header: 'Parameter', width: 28 },
      { header: 'Value', width: 48 },
    ],
    rows: input.rows,
  }
}

import 'server-only'

import type { LetterheadSource } from '@/lib/letterhead'
import {
  exportTableCsvResponse,
  exportTableToXlsx,
  exportTableXlsxResponse,
  type ExportColumn,
  type ExportTable,
} from '@/server/reports/export-table'

/** Dual-format response: Excel (default for staff) or CSV with the same headers. */
export async function preparedListResponse(input: {
  org: LetterheadSource
  title: string
  subtitle?: string
  currency?: string
  filenameBase: string
  format: 'xlsx' | 'csv'
  columns: ExportColumn[]
  rows: ExportTable['rows']
}): Promise<Response> {
  const table: ExportTable = { columns: input.columns, rows: input.rows }
  if (input.format === 'csv') {
    return exportTableCsvResponse(`${input.filenameBase}.csv`, table)
  }
  const body = await exportTableToXlsx({
    org: input.org,
    title: input.title,
    subtitle: input.subtitle,
    currency: input.currency,
    sheetName: input.title,
    table,
  })
  return exportTableXlsxResponse(`${input.filenameBase}.xlsx`, body)
}

export function readExportFormat(url: URL, fallback: 'xlsx' | 'csv' = 'xlsx'): 'xlsx' | 'csv' {
  const raw = (url.searchParams.get('format') ?? fallback).toLowerCase()
  return raw === 'csv' ? 'csv' : 'xlsx'
}

/**
 * How report sheets are drawn — separate from colour themes.
 * Stored in this browser under REPORT_STYLE_KEY; applied as data-report-style on <html>.
 */
export type ReportStyleId = 'herobooks' | 'quickbooks' | 'odoo'

export const REPORT_STYLE_KEY = 'bpc.reportStyle'

export type ReportStyleOption = {
  id: ReportStyleId
  label: string
  blurb: string
  /** Preview chips: sheet, band, accent. */
  swatches: [string, string, string]
}

export const REPORT_STYLES: ReportStyleOption[] = [
  {
    id: 'herobooks',
    label: 'SOM ERP',
    blurb: 'The sheet you already use — banded ledger rows, your theme colours.',
    swatches: ['#FFFFFF', '#D5DDE6', '#0F766E'],
  },
  {
    id: 'quickbooks',
    label: 'QuickBooks',
    blurb: 'QBO-style report: Source Sans, soft blue bands, green section marks.',
    swatches: ['#FFFFFF', '#E8EEF4', '#2CA01C'],
  },
  {
    id: 'odoo',
    label: 'Odoo',
    blurb: 'Live Odoo P&L: system fonts, grey total bands (#DEE2E6), plum Print, white sheet.',
    swatches: ['#FFFFFF', '#DEE2E6', '#714B67'],
  },
]

export const REPORT_STYLE_IDS = REPORT_STYLES.map((style) => style.id)

export const DEFAULT_REPORT_STYLE: ReportStyleId = 'herobooks'

export function parseReportStyle(raw: string | null | undefined): ReportStyleId {
  if (raw === 'quickbooks' || raw === 'odoo' || raw === 'herobooks') return raw
  return DEFAULT_REPORT_STYLE
}

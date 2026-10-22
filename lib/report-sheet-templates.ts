/**
 * Density of report / chart tables — Standard, Compact, or Plain.
 * Same key the report toolbar and chart of accounts already use.
 */

export type ReportSheetTemplateId = 'standard' | 'compact' | 'plain' | 'lined'

export const REPORT_SHEET_TEMPLATE_KEY = 'bpc.reportTemplate'

export const REPORT_SHEET_TEMPLATES: {
  id: ReportSheetTemplateId
  label: string
  blurb: string
}[] = [
  {
    id: 'standard',
    label: 'Standard',
    blurb: 'Banded rows — the usual report and chart look.',
  },
  {
    id: 'compact',
    label: 'Compact',
    blurb: 'Tighter rows when you need more lines on screen.',
  },
  {
    id: 'plain',
    label: 'Plain',
    blurb: 'No band colours — a flat white sheet.',
  },
  {
    id: 'lined',
    label: 'Lined',
    blurb: 'A line under each row. Add another style by extending this list.',
  },
]

export const DEFAULT_REPORT_SHEET_TEMPLATE: ReportSheetTemplateId = 'standard'

export function parseReportSheetTemplate(raw: string | null | undefined): ReportSheetTemplateId {
  if (raw === 'compact' || raw === 'plain' || raw === 'standard' || raw === 'lined') return raw
  return DEFAULT_REPORT_SHEET_TEMPLATE
}

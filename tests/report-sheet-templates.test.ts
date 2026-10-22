import { describe, expect, it } from 'vitest'

import {
  DEFAULT_REPORT_SHEET_TEMPLATE,
  parseReportSheetTemplate,
  REPORT_SHEET_TEMPLATE_KEY,
  REPORT_SHEET_TEMPLATES,
} from '@/lib/report-sheet-templates'

describe('report sheet templates (row density)', () => {
  it('lists Standard, Compact, and Plain', () => {
    expect(REPORT_SHEET_TEMPLATES.map((item) => item.id)).toEqual([
      'standard',
      'compact',
      'plain',
      'lined',
    ])
  })

  it('uses one browser key shared by reports and the chart', () => {
    expect(REPORT_SHEET_TEMPLATE_KEY).toBe('bpc.reportTemplate')
  })

  it('accepts known ids and falls back for junk', () => {
    expect(parseReportSheetTemplate('compact')).toBe('compact')
    expect(parseReportSheetTemplate('plain')).toBe('plain')
    expect(parseReportSheetTemplate('standard')).toBe('standard')
    expect(parseReportSheetTemplate('lined')).toBe('lined')
    expect(parseReportSheetTemplate(null)).toBe(DEFAULT_REPORT_SHEET_TEMPLATE)
    expect(parseReportSheetTemplate(undefined)).toBe(DEFAULT_REPORT_SHEET_TEMPLATE)
    expect(parseReportSheetTemplate('nope')).toBe(DEFAULT_REPORT_SHEET_TEMPLATE)
  })

  it('describes Compact as the same banded sheet, tighter', () => {
    const compact = REPORT_SHEET_TEMPLATES.find((item) => item.id === 'compact')
    expect(compact?.label).toBe('Compact')
    expect(compact?.blurb.toLowerCase()).toMatch(/tight/)
  })
})

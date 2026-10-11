import { describe, expect, it } from 'vitest'

import { DEFAULT_REPORT_STYLE, parseReportStyle, REPORT_STYLES } from '@/lib/report-styles'

describe('report styles', () => {
  it('lists the three Appearance choices', () => {
    expect(REPORT_STYLES.map((style) => style.id)).toEqual(['herobooks', 'quickbooks', 'odoo'])
  })

  it('accepts known ids and falls back for junk', () => {
    expect(parseReportStyle('quickbooks')).toBe('quickbooks')
    expect(parseReportStyle('odoo')).toBe('odoo')
    expect(parseReportStyle('herobooks')).toBe('herobooks')
    expect(parseReportStyle(null)).toBe(DEFAULT_REPORT_STYLE)
    expect(parseReportStyle('nope')).toBe(DEFAULT_REPORT_STYLE)
  })
})

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_REPORT_STYLE,
  isVipTheme,
  parseReportStyle,
  parseReportStyleCustom,
  REPORT_STYLES,
  reportStyleForTheme,
} from '@/lib/report-styles'

describe('report styles', () => {
  it('lists expanded Appearance paper choices including world clones and custom', () => {
    expect(REPORT_STYLES.map((style) => style.id)).toEqual([
      'herobooks',
      'quickbooks',
      'odoo',
      'xero',
      'sage',
      'wave',
      'freshbooks',
      'zoho',
      'sap',
      'dynamics',
      'netsuite',
      'luxury',
      'ai',
      'ink',
      'slate',
      'emerald',
      'sand',
      'custom',
    ])
  })

  it('accepts known ids and falls back for junk', () => {
    expect(parseReportStyle('quickbooks')).toBe('quickbooks')
    expect(parseReportStyle('odoo')).toBe('odoo')
    expect(parseReportStyle('xero')).toBe('xero')
    expect(parseReportStyle('sage')).toBe('sage')
    expect(parseReportStyle('wave')).toBe('wave')
    expect(parseReportStyle('freshbooks')).toBe('freshbooks')
    expect(parseReportStyle('zoho')).toBe('zoho')
    expect(parseReportStyle('sap')).toBe('sap')
    expect(parseReportStyle('dynamics')).toBe('dynamics')
    expect(parseReportStyle('netsuite')).toBe('netsuite')
    expect(parseReportStyle('herobooks')).toBe('herobooks')
    expect(parseReportStyle('luxury')).toBe('luxury')
    expect(parseReportStyle('ai')).toBe('ai')
    expect(parseReportStyle('custom')).toBe('custom')
    expect(parseReportStyle(null)).toBe(DEFAULT_REPORT_STYLE)
    expect(parseReportStyle('nope')).toBe(DEFAULT_REPORT_STYLE)
  })

  it('parses custom paper colours and maps themes to paper', () => {
    expect(parseReportStyleCustom('{"sheet":"#112233","band":"#445566","accent":"#778899"}')).toEqual({
      sheet: '#112233',
      band: '#445566',
      accent: '#778899',
    })
    expect(parseReportStyleCustom('{bad')).toEqual({
      sheet: '#FFFFFF',
      band: '#E8DCC8',
      accent: '#C4A574',
    })
    expect(reportStyleForTheme('luxury')).toBe('luxury')
    expect(reportStyleForTheme('ai')).toBe('ai')
    expect(reportStyleForTheme('odoo')).toBe('odoo')
    expect(reportStyleForTheme('som')).toBe('herobooks')
  })

  it('pairs VIP desks with matching paper only', () => {
    expect(isVipTheme('luxury')).toBe(true)
    expect(isVipTheme('ai')).toBe(true)
    expect(isVipTheme('som')).toBe(false)
    expect(isVipTheme('odoo')).toBe(false)
    // Leftover Odoo/Slate paper must not stick on VIP desks.
    expect(reportStyleForTheme('luxury')).not.toBe('odoo')
    expect(reportStyleForTheme('luxury')).not.toBe('quickbooks')
    expect(reportStyleForTheme('ai')).not.toBe('slate')
    expect(reportStyleForTheme('ai')).not.toBe('odoo')
  })
})

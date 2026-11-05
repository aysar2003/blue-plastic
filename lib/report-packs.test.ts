import { describe, expect, it } from 'vitest'

import {
  assertPackReportKeys,
  composePackCsv,
  knownPackReportKeys,
  nextRunAfter,
  reportKeyFromHref,
} from '@/lib/report-packs'

describe('report packs', () => {
  it('extracts keys from standard hrefs', () => {
    expect(reportKeyFromHref('/reports/profit-loss')).toBe('profit-loss')
    expect(reportKeyFromHref('/reports/ar-aging?x=1')).toBe('ar-aging')
  })

  it('lists known keys and rejects unknowns', () => {
    const keys = knownPackReportKeys()
    expect(keys).toContain('profit-loss')
    expect(assertPackReportKeys([])).toMatch(/at least one/)
    expect(assertPackReportKeys(['not-a-real-report'])).toMatch(/not a standard/)
    expect(assertPackReportKeys(['profit-loss', 'balance-sheet'])).toBeNull()
  })

  it('advances cadence and composes CSV sections', () => {
    const base = new Date(Date.UTC(2026, 0, 1, 12, 0, 0))
    expect(nextRunAfter('MANUAL', base)).toBeNull()
    expect(nextRunAfter('DAILY', base)?.toISOString()).toBe('2026-01-02T12:00:00.000Z')
    expect(nextRunAfter('WEEKLY', base)?.toISOString()).toBe('2026-01-08T12:00:00.000Z')
    const csv = composePackCsv([
      { title: 'P&L', key: 'profit-loss', csv: 'a,b\n1,2' },
      { title: 'BS', key: 'balance-sheet', csv: 'c,d\n3,4' },
    ])
    expect(csv).toContain('# P&L (profit-loss)')
    expect(csv).toContain('# BS (balance-sheet)')
    expect(csv).toContain('1,2')
  })
})

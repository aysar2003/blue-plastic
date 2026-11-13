import { describe, expect, it } from 'vitest'

import { resolveAnalyticsPeriod } from '@/lib/analytics-period'

describe('resolveAnalyticsPeriod', () => {
  it('supports all-dates and legacy month', () => {
    const all = resolveAnalyticsPeriod({
      period: 'all-dates',
      timeZone: 'UTC',
      fiscalYearStartMonth: 1,
    })
    expect(all.key).toBe('all-dates')
    expect(all.range.from).toBe('1900-01-01')
    expect(all.label).toBe('All dates')

    const month = resolveAnalyticsPeriod({
      month: '2026-10',
      timeZone: 'UTC',
      fiscalYearStartMonth: 1,
    })
    expect(month.range.from).toBe('2026-10-01')
    expect(month.range.to).toBe('2026-10-31')
  })

  it('supports custom from/to', () => {
    const custom = resolveAnalyticsPeriod({
      period: 'custom',
      from: '2025-01-01',
      to: '2025-03-31',
      timeZone: 'UTC',
      fiscalYearStartMonth: 1,
    })
    expect(custom.key).toBe('custom')
    expect(custom.range.from).toBe('2025-01-01')
    expect(custom.range.to).toBe('2025-03-31')
  })
})

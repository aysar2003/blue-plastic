import { describe, expect, it } from 'vitest'

import {
  buildAnalyticsBrief,
  dailyCandlesFromTotals,
  weeklyCandlesFromDaily,
} from '@/lib/analytics-brief'

describe('analytics candles', () => {
  it('builds daily OHLC from day totals', () => {
    const candles = dailyCandlesFromTotals([
      { day: '2026-11-01', amount: '100.00' },
      { day: '2026-11-02', amount: '80.00' },
      { day: '2026-11-03', amount: '120.00' },
    ])
    expect(candles).toHaveLength(3)
    expect(candles[0]).toMatchObject({
      key: '2026-11-01',
      open: '0.00',
      close: '100.00',
      high: '100.00',
      low: '0.00',
    })
    expect(candles[1]).toMatchObject({
      open: '100.00',
      close: '80.00',
      high: '100.00',
      low: '80.00',
    })
    expect(candles[2]?.open).toBe('80.00')
    expect(candles[2]?.close).toBe('120.00')
  })

  it('rolls daily candles into weekly OHLC', () => {
    const daily = dailyCandlesFromTotals([
      { day: '2026-11-02', amount: '10.00' },
      { day: '2026-11-03', amount: '20.00' },
      { day: '2026-11-04', amount: '15.00' },
    ])
    const weekly = weeklyCandlesFromDaily(daily)
    expect(weekly.length).toBeGreaterThanOrEqual(1)
    expect(weekly[0]?.open).toBe(daily[0]?.open)
    expect(weekly[0]?.close).toBe(daily[daily.length - 1]?.close)
  })
})

describe('buildAnalyticsBrief', () => {
  it('returns a versioned AI-ready payload with series and narratives', () => {
    const days = [
      { day: '2026-11-01', amount: '50.00' },
      { day: '2026-11-02', amount: '75.00' },
    ]
    const candlesDaily = dailyCandlesFromTotals(days)
    const brief = buildAnalyticsBrief({
      org: {
        id: 'org1',
        name: 'Demo Co',
        currency: 'USD',
        timeZone: 'Africa/Nairobi',
      },
      period: {
        month: '2026-11',
        from: '2026-11-01',
        to: '2026-11-30',
        label: 'November 2026',
      },
      currency: 'USD',
      profit: { net: '200.00', income: '500.00', expenses: '300.00', change: '10' },
      bankTotal: '1000.00',
      cashMonths: [
        { label: 'Jan', amount: '10.00' },
        { label: 'Feb', amount: '-5.00' },
      ],
      invoices: { unpaid: '100.00', overdue: '40.00', paid: '60.00' },
      spending: {
        total: '300.00',
        costOfSales: '180.00',
        other: '120.00',
        change: '5',
      },
      sales: { total: '125.00', days },
      candlesDaily,
      candlesWeekly: weeklyCandlesFromDaily(candlesDaily),
      generatedAt: '2026-11-12T12:00:00.000Z',
    })

    expect(brief.version).toBe(1)
    expect(brief.summary.length).toBeGreaterThan(20)
    expect(brief.narrative.sales).toContain('125.00')
    expect(brief.metrics.profitNet.value).toBe('200.00')
    expect(brief.series.candlesDaily).toHaveLength(2)
    expect(brief.charts.some((c) => c.type === 'candles')).toBe(true)
    expect(brief.risks.some((r) => r.id === 'ar-overdue')).toBe(true)
  })
})

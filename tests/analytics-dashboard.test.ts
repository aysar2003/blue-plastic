import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AnalysisPanel } from '@/components/analytics/analysis-panel'
import {
  BankAccountsPanel,
  CollectionProgress,
  MetricsTable,
  ProfitSplitBars,
  TopSalesDaysPanel,
} from '@/components/analytics/data-panels'
import { AnalyticsKpiStrip } from '@/components/analytics/kpi-strip'
import { CashBars } from '@/components/analytics/cash-bars'
import { SalesLine } from '@/components/analytics/sales-line'
import { ShareRing } from '@/components/analytics/share-ring'
import { LAUNCHER_APPS, LAUNCHER_FOLDERS } from '@/components/layout/launcher-apps'
import { MODULES } from '@/components/layout/nav-items'
import {
  buildAnalyticsBrief,
  dailyCandlesFromTotals,
  weeklyCandlesFromDaily,
} from '@/lib/analytics-brief'
import { MODULE_KEY_TO_FLAG, moduleForPath } from '@/lib/feature-flags'

function sampleBrief() {
  const days = [
    { day: '2026-11-01', amount: '40.00' },
    { day: '2026-11-02', amount: '90.00' },
    { day: '2026-11-03', amount: '20.00' },
  ]
  const candlesDaily = dailyCandlesFromTotals(days)
  return buildAnalyticsBrief({
    org: { id: 'o1', name: 'Al Furaat', currency: 'USD', timeZone: 'Africa/Nairobi' },
    period: {
      month: '2026-11',
      from: '2026-11-01',
      to: '2026-11-30',
      label: 'November 2026',
    },
    currency: 'USD',
    profit: { net: '-50.00', income: '200.00', expenses: '250.00', change: '-12' },
    bankTotal: '800.00',
    cashMonths: [
      { label: 'Jan', amount: '5.00' },
      { label: 'Feb', amount: '-30.00' },
    ],
    invoices: { unpaid: '500.00', overdue: '250.00', paid: '100.00' },
    spending: {
      total: '250.00',
      costOfSales: '150.00',
      other: '100.00',
      change: '8',
    },
    sales: { total: '150.00', days },
    candlesDaily,
    candlesWeekly: weeklyCandlesFromDaily(candlesDaily),
    generatedAt: '2026-11-12T18:00:00.000Z',
  })
}

describe('analytics app wiring', () => {
  it('registers Analytics in launcher, finance folder, nav, and reports flag', () => {
    const app = LAUNCHER_APPS.find((row) => row.key === 'analytics')
    expect(app?.href).toBe('/analytics')
    expect(app?.permission).toBe('report:overview')
    expect(MODULE_KEY_TO_FLAG.analytics).toBe('reports')
    expect(moduleForPath('/analytics')).toBe('reports')
    expect(moduleForPath('/analytics/anything')).toBe('reports')

    const finance = LAUNCHER_FOLDERS.find((folder) => folder.id === 'finance')
    expect(finance?.appKeys).toContain('analytics')

    const analyticsModule = MODULES.find((row) => row.key === 'analytics')
    expect(analyticsModule?.owns).toContain('/analytics')
    expect(analyticsModule?.permission).toBe('report:overview')
  })
})

describe('analytics dense board UI', () => {
  it('renders KPI strip, charts, panels, and analysis from a rich brief', () => {
    const brief = sampleBrief()
    expect(brief.risks.some((r) => r.id === 'loss')).toBe(true)
    expect(brief.risks.some((r) => r.id === 'ar-overdue' && r.severity === 'high')).toBe(true)
    expect(brief.series.candlesDaily).toHaveLength(3)
    expect(brief.series.candlesWeekly.length).toBeGreaterThanOrEqual(1)

    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(AnalyticsKpiStrip, {
          items: [
            {
              key: 'profitNet',
              label: 'Profit',
              value: '$ -50.00',
              href: '/reports/profit-loss',
              tone: 'down' as const,
              hint: '-12% vs prior',
            },
            {
              key: 'salesTotal',
              label: 'Sales',
              value: '$ 150.00',
              href: '/sales/invoices',
              hint: '3 active days',
            },
          ],
        }),
        createElement(CashBars, {
          months: brief.series.cashMonths,
          currency: 'USD',
          year: '2026',
        }),
        createElement(SalesLine, { days: brief.series.salesDays, currency: 'USD' }),
        createElement(ShareRing, {
          costOfSales: '150.00',
          other: '100.00',
          currency: 'USD',
        }),
        createElement(ProfitSplitBars, {
          income: '200.00',
          expenses: '250.00',
          net: '-50.00',
          currency: 'USD',
        }),
        createElement(CollectionProgress, {
          paid: '100.00',
          deposited: '70.00',
          notDeposited: '30.00',
          depositedShare: 70,
          currency: 'USD',
        }),
        createElement(BankAccountsPanel, {
          banks: [
            { id: 'b1', name: 'Main', balance: '500.00', subtype: 'BANK' },
            { id: 'b2', name: 'Till', balance: '300.00', subtype: 'UNDEPOSITED_FUNDS' },
          ],
          currency: 'USD',
          total: '800.00',
        }),
        createElement(TopSalesDaysPanel, {
          days: brief.series.salesDays,
          currency: 'USD',
        }),
        createElement(MetricsTable, {
          rows: Object.entries(brief.metrics).map(([key, metric]) => ({
            key,
            label: metric.label,
            value: metric.value,
            unit: metric.unit,
          })),
        }),
        createElement(AnalysisPanel, { brief }),
      ),
    )

    expect(html).toContain('Profit')
    expect(html).toContain('Sales')
    expect(html).toContain('Cost of sales')
    expect(html).toContain('Collected this period')
    expect(html).toContain('Main')
    expect(html).toContain('undeposited')
    expect(html).toContain('What the numbers say')
    expect(html).toContain('High overdue receivables')
    expect(html).toContain('Loss this period')
    expect(html).toContain('Metric')
    expect(html).toContain('Customers still owe')
  })

  it('handles empty sales / banks / spending without crashing', () => {
    expect(
      renderToStaticMarkup(createElement(SalesLine, { days: [], currency: 'USD' })),
    ).toContain('No sales days')
    expect(
      renderToStaticMarkup(
        createElement(BankAccountsPanel, { banks: [], currency: 'USD', total: '0.00' }),
      ),
    ).toContain('No bank accounts')
    expect(
      renderToStaticMarkup(
        createElement(ShareRing, { costOfSales: '0.00', other: '0.00', currency: 'USD' }),
      ),
    ).toContain('No spending')
    expect(
      renderToStaticMarkup(createElement(TopSalesDaysPanel, { days: [], currency: 'USD' })),
    ).toContain('No sales days')
  })
})

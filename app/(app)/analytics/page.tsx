import type { Metadata } from 'next'
import Link from 'next/link'

import { AnalysisPanel, AnalyticsBriefEmbed } from '@/components/analytics/analysis-panel'
import { AnalyticsPeriod } from '@/components/analytics/analytics-period'
import { CashBars } from '@/components/analytics/cash-bars'
import { ChartFrame } from '@/components/analytics/chart-frame'
import {
  BankAccountsPanel,
  CollectionProgress,
  MetricsTable,
  ProfitSplitBars,
  TopSalesDaysPanel,
} from '@/components/analytics/data-panels'
import { AnalyticsKpiStrip } from '@/components/analytics/kpi-strip'
import { SalesCandles } from '@/components/analytics/sales-candles'
import { SalesLine } from '@/components/analytics/sales-line'
import { ShareRing } from '@/components/analytics/share-ring'
import { AccessDenied } from '@/components/system/access-denied'
import { canViewBusinessOverview } from '@/lib/business-overview-access'
import { formatDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { loadAnalyticsDashboard } from '@/server/services/analytics-dashboard.service'

export const metadata: Metadata = { title: 'Analytics' }

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; month?: string }>
}) {
  const ctx = await requireOrgContext()
  if (!canViewBusinessOverview(ctx.permissions)) {
    return <AccessDenied section="Analytics" />
  }

  const query = await searchParams
  const board = await loadAnalyticsDashboard(ctx, query)
  const {
    overview,
    selection,
    brief,
    currency,
    kpis,
    banks,
    topSalesDays,
    collections,
    profitSplit,
    extras,
    metricRows,
  } = board
  const periodQuery = `period=custom&from=${overview.lastMonth.from}&to=${overview.lastMonth.to}`
  const briefHref = `/api/analytics/brief?period=${selection.key}${
    selection.key === 'custom' ? `&from=${selection.range.from}&to=${selection.range.to}` : ''
  }`

  return (
    <div className="analytics-board relative min-h-[70vh] pb-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_120%_80%_at_0%_-10%,color-mix(in_oklab,var(--chart-net,#0369A1)_14%,transparent),transparent_50%),radial-gradient(ellipse_80%_60%_at_100%_0%,color-mix(in_oklab,var(--chart-income,#0F766E)_10%,transparent),transparent_45%)]"
      />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {ctx.organization.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Analytics dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selection.label} · as at {formatDate(overview.now)} · {formatDate(selection.range.from)} →{' '}
            {formatDate(selection.range.to)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/90 px-3 py-2 shadow-sm">
          <AnalyticsPeriod
            periodKey={selection.key}
            from={selection.range.from}
            to={selection.range.to}
          />
          <Link
            href={briefHref}
            className="rounded-full bg-muted px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-primary/10 hover:text-primary"
          >
            AI JSON
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        <AnalyticsKpiStrip items={kpis} />

        {/* Hero charts — ERP dashboard style */}
        <div className="grid gap-4 xl:grid-cols-12">
          <ChartFrame
            className="xl:col-span-8"
            title="Revenue trend"
            caption={`Sales series for ${selection.label} (${selection.range.from} → ${selection.range.to})`}
            href="/sales/invoices"
            hrefLabel="Sales"
            tall
          >
            <SalesLine days={overview.sales.days} currency={currency} />
          </ChartFrame>
          <ChartFrame
            className="xl:col-span-4"
            title="Spending mix"
            caption="Cost of sales vs other expenses"
            href={`/reports/profit-loss?${periodQuery}`}
            tall
          >
            <ShareRing
              costOfSales={overview.spending.costOfSales}
              other={overview.spending.other}
              currency={currency}
            />
          </ChartFrame>
        </div>

        <div className="grid gap-4 xl:grid-cols-12">
          <ChartFrame
            className="xl:col-span-7"
            title="Sales candles"
            caption="OHLC with volume — daily or weekly"
            href="/sales/invoices"
            hrefLabel="Sales"
            tall
          >
            <SalesCandles
              daily={brief.series.candlesDaily}
              weekly={brief.series.candlesWeekly}
              currency={currency}
            />
          </ChartFrame>
          <ChartFrame
            className="xl:col-span-5"
            title={`Cash flow · ${overview.year}`}
            caption="Bank & undeposited monthly movement"
            href="/reports/cash-flow"
            tall
          >
            <CashBars months={overview.cashMonths} currency={currency} year={overview.year} />
          </ChartFrame>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ChartFrame
            title="Profit split"
            caption="Income · expenses · net"
            href={`/reports/profit-loss?${periodQuery}`}
          >
            <ProfitSplitBars
              income={profitSplit.income}
              expenses={profitSplit.expenses}
              net={profitSplit.net}
              currency={currency}
            />
          </ChartFrame>
          <ChartFrame title="Collections" caption="Deposited vs undeposited" href="/payments">
            <CollectionProgress {...collections} currency={currency} />
          </ChartFrame>
          <ChartFrame title="Top sales points" caption={`Strongest buckets in ${selection.label}`} href="/sales/invoices">
            <TopSalesDaysPanel days={topSalesDays} currency={currency} />
          </ChartFrame>
          <ChartFrame title="Bank accounts" caption="Balances on hand" href="/banking/accounts">
            <BankAccountsPanel banks={banks} currency={currency} total={overview.bankTotal} />
          </ChartFrame>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <ChartFrame
            className="lg:col-span-7"
            title="Metrics table"
            caption="Every figure on this board"
          >
            <MetricsTable rows={metricRows} />
          </ChartFrame>
          <ChartFrame
            className="lg:col-span-5"
            title="Operating pulse"
            caption="Outside the P&L"
          >
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                {
                  label: 'Unpaid bills',
                  value: board.kpis.find((k) => k.key === 'unpaidAp')?.value ?? '—',
                  href: '/reports/ap-aging',
                  hint: null as string | null,
                },
                {
                  label: 'Pipeline',
                  value: board.kpis.find((k) => k.key === 'pipeline')?.value ?? '—',
                  href: '/customers/pipeline',
                  hint: `${extras.pipelineCount} deals`,
                },
                {
                  label: 'Follow-ups',
                  value: String(extras.followUps),
                  href: '/customers/tickets',
                  hint: null,
                },
                {
                  label: 'To reorder',
                  value: extras.reorderCount == null ? '—' : String(extras.reorderCount),
                  href: '/reports/inventory-reorder',
                  hint: null,
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/50 to-transparent px-3.5 py-3"
                >
                  <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    {card.label}
                  </dt>
                  <dd className="mt-1.5 text-lg font-bold tabular-nums">
                    <Link href={card.href} className="hover:text-primary">
                      {card.value}
                    </Link>
                  </dd>
                  {card.hint ? (
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{card.hint}</p>
                  ) : null}
                </div>
              ))}
            </dl>
          </ChartFrame>
        </div>

        <AnalysisPanel brief={brief} />
      </div>

      <AnalyticsBriefEmbed brief={brief} />
    </div>
  )
}

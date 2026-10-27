import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { OverviewPeriod } from '@/components/reports/overview-period'
import { AccessDenied } from '@/components/system/access-denied'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { canViewBusinessOverview } from '@/lib/business-overview-access'
import { formatDate } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { cn } from '@/lib/utils'
import { requireOrgContext } from '@/server/auth/context'
import { businessOverview } from '@/server/services/business-overview'

export const metadata: Metadata = { title: 'Business overview' }

const TABS = [
  { href: '/dashboard', label: 'Get things done' },
  { href: '/reports/business-overview', label: 'Business overview' },
  { href: '/reports/cash-flow', label: 'Cash flow' },
  { href: '/periods', label: 'Planner' },
]

function changeText(value: string | null, prior: string) {
  if (value == null) return `No ${prior} to compare`
  const amount = Number(value)
  if (amount === 0) return `Same as ${prior}`
  const direction = amount > 0 ? 'Up' : 'Down'
  return `${direction} ${Math.abs(amount)}% from ${prior}`
}

export default async function BusinessOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const ctx = await requireOrgContext()
  if (!canViewBusinessOverview(ctx.permissions)) {
    return <AccessDenied section="Business overview" />
  }
  const { month: requestedMonth } = await searchParams
  const overview = await businessOverview(ctx, requestedMonth)
  const currentYear = Number(overview.now.slice(0, 4))
  const years = Array.from({ length: 16 }, (_, index) => currentYear - index)
  const monthLabel = formatDate(overview.lastMonth.from).replace(/ \d+,/, '')
  const periodQuery = `period=custom&from=${overview.lastMonth.from}&to=${overview.lastMonth.to}`
  const currency = ctx.organization.baseCurrency
  const money = (value: string) => formatMoney(value, currency)
  const peak = Math.max(
    1,
    ...overview.cashMonths.map((month) => Math.abs(Number(month.amount))),
  )
  const spendTotal = new Decimal(overview.spending.total)
  const costShare = spendTotal.isZero()
    ? 0
    : new Decimal(overview.spending.costOfSales).dividedBy(spendTotal.abs()).times(100).toNumber()
  const salesPeak = Math.max(1, ...overview.sales.days.map((day) => Number(day.amount)))
  const unpaid = new Decimal(overview.invoices.unpaid)
  const overdue = new Decimal(overview.invoices.overdue)
  const overdueShare = unpaid.isZero() ? 0 : Math.min(100, overdue.dividedBy(unpaid).times(100).toNumber())
  const paid = new Decimal(overview.invoices.paid)
  const deposited = new Decimal(overview.invoices.deposited)
  const depositedShare = paid.isZero() ? 0 : Math.min(100, deposited.dividedBy(paid).times(100).toNumber())

  return (
    <>
      <nav aria-label="Overview" className="mb-4 flex gap-1 overflow-x-auto border-b print:hidden">
        {TABS.map((tab) => {
          const on = tab.href === '/reports/business-overview'
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'shrink-0 border-b-2 px-3 py-2 text-sm',
                on ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <OverviewPeriod month={overview.month} years={years} />
      </div>

      <PageHeader
        organization={ctx.organization}
        title="Business overview"
        description={`${ctx.organization.name} · figures from the ledger as at ${formatDate(overview.now)}.`}
      />

      <div className="flex flex-col">
      <div className="order-2 mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cash flow · {overview.year}</CardTitle>
            <p className="text-base font-medium">Track how your money is doing</p>
            <p className="text-sm text-muted-foreground">
              Each bar is the net movement in bank accounts and undeposited funds for that month of {overview.year}.
            </p>
            <ul className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-primary" />
                Money in
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-destructive" />
                Money out
              </li>
            </ul>
          </CardHeader>
          <CardContent>
            {overview.hasBank ? (
              <div className="flex h-40 items-end gap-2 border-b border-border pb-1">
                {overview.cashMonths.map((month) => {
                  const value = Number(month.amount)
                  const height = Math.max(4, (Math.abs(value) / peak) * 100)
                  return (
                    <div key={month.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <div
                        title={`${month.label} ${money(month.amount)}`}
                        className={cn('w-full max-w-8 rounded-sm', value < 0 ? 'bg-destructive' : 'bg-primary')}
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[0.65rem] text-muted-foreground">{month.label}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm text-muted-foreground">
                <div className="flex w-full items-end justify-between gap-1 px-2 opacity-40" aria-hidden>
                  {overview.cashMonths.map((month) => (
                    <span key={month.label} className="h-1 flex-1 rounded-sm bg-primary" />
                  ))}
                </div>
                <Link href="/banking/import" className="font-medium text-primary hover:underline">
                  Link your bank to see cash flow
                </Link>
              </div>
            )}
            <p className="mt-3 text-center text-sm">
              <Link href="/reports/cash-flow?period=this-fiscal-year" className="text-primary hover:underline">
                Open the statement of cash flows
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bank accounts</CardTitle>
            <span className="text-xs text-muted-foreground">As of today</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Total bank balance</p>
              <p className="text-2xl font-semibold tabular">{money(overview.bankTotal)}</p>
            </div>
            <ul className="space-y-2 border-t border-border pt-3">
              {overview.banks.length === 0 ? (
                <li className="text-sm text-muted-foreground">No bank accounts on the chart.</li>
              ) : (
                overview.banks.map((account) => (
                  <li key={account.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link href={`/accounts/${account.id}`} className="hover:underline">
                      {account.name}
                    </Link>
                    <span className="tabular">{money(account.balance)}</span>
                  </li>
                ))
              )}
            </ul>
            <Link href="/banking/accounts" className="inline-block text-sm text-primary hover:underline">
              Go to registers
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="order-1 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profit & loss</CardTitle>
            <span className="text-xs text-muted-foreground">{monthLabel}</span>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Net profit for {monthLabel}
            </p>
            <p className="text-2xl font-semibold tabular">{money(overview.profit.net)}</p>
            <p className="text-sm text-primary">{changeText(overview.profit.change, 'the prior month')}</p>
            <div className="mt-4 space-y-2 text-sm">
              <Bar label="Income" amount={overview.profit.income} currency={currency} tone="bg-primary" />
              <Bar label="Expenses" amount={overview.profit.expenses} currency={currency} tone="bg-foreground/70" />
            </div>
            <Link href={`/reports/profit-loss?${periodQuery}`} className="mt-3 inline-block text-sm text-primary hover:underline">
              See profit and loss report
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expenses</CardTitle>
            <span className="text-xs text-muted-foreground">{monthLabel}</span>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Spending for {monthLabel}</p>
            <p className="text-2xl font-semibold tabular">{money(overview.spending.total)}</p>
            <p className="text-sm text-primary">{changeText(overview.spending.change, 'the prior month')}</p>
            <div className="mt-4 flex items-center gap-4">
              <div
                className="grid size-24 shrink-0 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(var(--primary) 0 ${costShare}%, color-mix(in srgb, var(--foreground) 55%, var(--muted)) ${costShare}% 100%)`,
                }}
                role="img"
                aria-label={`Cost of sales ${money(overview.spending.costOfSales)}, other ${money(overview.spending.other)}`}
              >
                <span className="size-12 rounded-full bg-card" />
              </div>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" />
                  Cost of sales {money(overview.spending.costOfSales)}
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-foreground/55" />
                  Other expense {money(overview.spending.other)}
                </li>
              </ul>
            </div>
            <Link href="/purchases/expenses?date=last12" className="mt-3 inline-block text-sm text-primary hover:underline">
              View all spending
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoices</CardTitle>
            <span className="text-xs text-muted-foreground">{overview.year}</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-semibold tabular">{money(overview.invoices.unpaid)}</p>
            <p className="text-xs text-muted-foreground">Unpaid</p>
            <div className="h-3 overflow-hidden rounded-sm bg-muted">
              <div className="h-full bg-destructive" style={{ width: `${Math.max(overdueShare, unpaid.isZero() ? 0 : 4)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Overdue {money(overview.invoices.overdue)}</p>
            <p className="text-sm">Paid in {monthLabel} {money(overview.invoices.paid)}</p>
            <div className="flex h-8 overflow-hidden rounded-sm text-[0.65rem] text-primary-foreground">
              <div className="bg-primary" style={{ width: `${Math.max(depositedShare, paid.isZero() ? 50 : 8)}%` }} />
              <div className="flex-1 bg-foreground/75" />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Not deposited {money(overview.invoices.notDeposited)}</span>
              <span>Deposited {money(overview.invoices.deposited)}</span>
            </div>
            <Link href="/reports/open-invoices" className="inline-block text-sm text-primary hover:underline">
              Open invoices
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales</CardTitle>
            <span className="text-xs text-muted-foreground">{monthLabel}</span>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Total amount</p>
            <p className="text-2xl font-semibold tabular">{money(overview.sales.total)}</p>
            <div className="relative mt-4 h-28">
              {overview.sales.days.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sales last month.</p>
              ) : (
                <div className="flex h-full items-end gap-px">
                  {overview.sales.days.map((day) => (
                    <div
                      key={day.day}
                      title={`${day.day} ${money(day.amount)}`}
                      className="w-1.5 rounded-full bg-primary"
                      style={{ height: `${Math.max(8, (Number(day.amount) / salesPeak) * 100)}%` }}
                    />
                  ))}
                </div>
              )}
            </div>
            <Link href={`/reports/sales-by-customer?${periodQuery}`} className="mt-3 inline-block text-sm text-primary hover:underline">
              Sales by customer
            </Link>
          </CardContent>
        </Card>
      </div>
      </div>
    </>
  )
}

function Bar({
  label,
  amount,
  currency,
  tone,
}: {
  label: string
  amount: string
  currency: string
  tone: string
}) {
  const value = new Decimal(amount)
  const width = value.abs().isZero() ? 0 : 100
  return (
    <div>
      <div className="mb-1 flex justify-between gap-3">
        <span>{label}</span>
        <span className="tabular">{formatMoney(value.isZero() ? ZERO : value, currency)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full', tone)} style={{ width: value.isZero() ? '0%' : `${width}%` }} />
      </div>
    </div>
  )
}

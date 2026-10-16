import Link from 'next/link'
import { PlusIcon } from 'lucide-react'

import { listHref } from '@/lib/list-filters'
import { MONEY_BAR } from '@/lib/money-bar-bands'
import { Decimal, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const BANDS = [
  { key: 'today', label: 'Today', field: 'todayTotal', count: 'todayCount', bar: MONEY_BAR.today.bar },
  { key: 'month', label: 'This month', field: 'monthTotal', count: 'monthCount', bar: MONEY_BAR.month.bar },
  { key: 'year', label: 'This year', field: 'yearTotal', count: 'yearCount', bar: MONEY_BAR.year.bar },
  { key: 'all', label: 'All dates', field: 'allTotal', count: 'allCount', bar: MONEY_BAR.older.bar },
] as const

export type ExpenseHomeFigures = {
  todayTotal: string
  todayCount: number
  monthTotal: string
  monthCount: number
  yearTotal: string
  yearCount: number
  allTotal: string
  allCount: number
}

/** Expenses dashboard — paid on the spot, with New expense like New invoice. */
export function ExpenseHome({
  currency,
  canCreate,
  active,
  params,
  home,
}: {
  currency: string
  canCreate: boolean
  active: string
  params: Record<string, string | undefined>
  home: ExpenseHomeFigures
}) {
  const today = new Decimal(home.todayTotal)
  const month = Decimal.max(new Decimal(home.monthTotal).minus(today), 0)
  const year = Decimal.max(new Decimal(home.yearTotal).minus(new Decimal(home.monthTotal)), 0)
  const older = Decimal.max(new Decimal(home.allTotal).minus(new Decimal(home.yearTotal)), 0)
  const slices = [
    { key: 'today', amount: today, bar: MONEY_BAR.today.bar, label: 'Today' },
    { key: 'month', amount: month, bar: MONEY_BAR.month.bar, label: 'Rest of this month' },
    { key: 'year', amount: year, bar: MONEY_BAR.year.bar, label: 'Rest of this year' },
    { key: 'older', amount: older, bar: MONEY_BAR.older.bar, label: 'Earlier' },
  ].filter((slice) => !slice.amount.isZero())
  const barTotal = slices.reduce((sum, slice) => sum.plus(slice.amount), new Decimal(0))

  return (
    <section className="mb-6 overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-16px_rgba(15,23,42,0.18)] ring-1 ring-border">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-primary px-5 py-6 text-primary-foreground sm:px-6">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">
            Expenses
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary-foreground">
            Money spent on the spot
          </h1>
          <p className="mt-1 max-w-md text-sm text-primary-foreground/80">
            Paid from cash, bank, or card — posted straight to the books. Pick a period to narrow the
            register below.
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/purchases/expenses/new"
            className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-accent"
          >
            <PlusIcon className="size-4" aria-hidden />
            New expense
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4">
        {BANDS.map((band, index) => {
          const amount = home[band.field]
          const count = home[band.count]
          const on = active === band.key
          return (
            <Link
              key={band.key}
              href={listHref('/purchases/expenses', { ...params, date: on ? 'last3' : band.key })}
              aria-current={on ? 'true' : undefined}
              className={cn(
                'px-5 py-4 sm:px-6',
                index % 2 === 1 && 'border-l',
                index >= 2 && 'border-t lg:border-t-0',
                index > 0 && 'lg:border-l',
                on && 'bg-accent',
              )}
            >
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {band.label}
              </p>
              <p className="mt-1 text-xl font-semibold tabular">{formatMoney(amount, currency)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {count === 1 ? '1 expense' : `${count} expenses`}
              </p>
            </Link>
          )
        })}
      </div>

      <div className="px-5 pb-4 sm:px-6">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
          {slices.map((slice) => {
            const share = barTotal.isZero() ? 0 : slice.amount.dividedBy(barTotal).times(100).toNumber()
            return (
              <span
                key={slice.key}
                className={slice.bar}
                style={{ width: `${Math.max(share, 2)}%` }}
                title={`${slice.label}: ${formatMoney(slice.amount.toFixed(2), currency)}`}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

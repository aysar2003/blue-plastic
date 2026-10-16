import Link from 'next/link'
import { PlusIcon } from 'lucide-react'

import { listHref } from '@/lib/list-filters'
import { MONEY_BAR } from '@/lib/money-bar-bands'
import { Decimal, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const BANDS = [
  { key: 'open', field: 'unpaid', count: 'unpaidCount', label: 'Unpaid', bar: MONEY_BAR.open.bar },
  {
    key: 'overdue',
    field: 'overdue',
    count: 'overdueCount',
    label: 'Overdue',
    bar: MONEY_BAR.overdue.bar,
    accent: MONEY_BAR.overdue.accent,
  },
  { key: 'notdue', field: 'notDue', count: 'notDueCount', label: 'Not due yet', bar: MONEY_BAR.notDue.bar },
  { key: 'paid', field: 'paid', count: 'paidCount', label: 'Paid', bar: MONEY_BAR.paid.bar },
] as const

export type BillHomeFigures = {
  unpaid: string
  unpaidCount: number
  overdue: string
  overdueCount: number
  notDue: string
  notDueCount: number
  paid: string
  paidCount: number
  draftTotal: string
  draftCount: number
}

/** Bills dashboard — what you owe vendors, matching the invoice home layout. */
export function BillHome({
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
  home: BillHomeFigures
}) {
  const barTotal = [home.overdue, home.notDue, home.paid].reduce(
    (sum, amount) => sum.plus(new Decimal(amount).abs()),
    new Decimal(0),
  )

  return (
    <section className="mb-6 overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-16px_rgba(15,23,42,0.18)] ring-1 ring-border">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-primary px-5 py-6 text-primary-foreground sm:px-6">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">
            Bills
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary-foreground">
            What you owe vendors
          </h1>
          <p className="mt-1 max-w-md text-sm text-primary-foreground/80">
            Unpaid stays on payables. Overdue uses the due date. Pay from Bill payments when you settle.
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/purchases/bills/new"
            className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-accent"
          >
            <PlusIcon className="size-4" aria-hidden />
            New bill
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
              href={listHref('/purchases/bills', { ...params, status: on ? undefined : band.key })}
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
              <p
                className={cn(
                  'mt-1 text-xl font-semibold tabular',
                  'accent' in band && band.accent ? band.accent : null,
                )}
              >
                {formatMoney(amount, currency)}
              </p>
              <p
                className={cn(
                  'mt-0.5 text-xs text-muted-foreground',
                  band.key === 'overdue' && MONEY_BAR.overdue.accent,
                )}
              >
                {count === 1 ? '1 bill' : `${count} bills`}
              </p>
            </Link>
          )
        })}
      </div>

      <div className="px-5 pb-4 sm:px-6">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
          {BANDS.filter((band) => band.key !== 'open' && !new Decimal(home[band.field]).isZero()).map(
            (band) => {
              const amount = new Decimal(home[band.field]).abs()
              const share = barTotal.isZero() ? 0 : amount.dividedBy(barTotal).times(100).toNumber()
              return (
                <span
                  key={band.key}
                  className={band.bar}
                  style={{ width: `${Math.max(share, 2)}%` }}
                  title={`${band.label}: ${formatMoney(home[band.field], currency)}`}
                />
              )
            },
          )}
        </div>
        {home.draftCount > 0 ? (
          <Link
            href={listHref('/purchases/bills', { ...params, status: active === 'draft' ? undefined : 'draft' })}
            className={cn(
              'mt-3 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline',
              active === 'draft' && 'font-medium text-foreground',
            )}
          >
            {home.draftCount === 1 ? '1 draft' : `${home.draftCount} drafts`} ·{' '}
            {formatMoney(home.draftTotal, currency)} not posted
          </Link>
        ) : null}
      </div>
    </section>
  )
}

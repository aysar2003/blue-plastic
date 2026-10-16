import Link from 'next/link'
import { PlusIcon } from 'lucide-react'

import { listHref } from '@/lib/list-filters'
import { MONEY_BAR } from '@/lib/money-bar-bands'
import { Decimal, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const BANDS = [
  { key: 'open', field: 'open', count: 'openCount', label: 'Open', bar: MONEY_BAR.open.bar },
  { key: 'paid', field: 'applied', count: 'appliedCount', label: 'Applied', bar: MONEY_BAR.paid.bar },
] as const

export type VendorCreditHomeFigures = {
  open: string
  openCount: number
  applied: string
  appliedCount: number
  draftTotal: string
  draftCount: number
}

/** Vendor credits dashboard — money the vendor owes you back. */
export function VendorCreditHome({
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
  home: VendorCreditHomeFigures
}) {
  const barTotal = BANDS.reduce(
    (sum, band) => sum.plus(new Decimal(home[band.field]).abs()),
    new Decimal(0),
  )

  return (
    <section className="mb-6 overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-16px_rgba(15,23,42,0.18)] ring-1 ring-border">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-primary px-5 py-6 text-primary-foreground sm:px-6">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">
            Vendor credits
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary-foreground">
            Credits that reduce what you owe
          </h1>
          <p className="mt-1 max-w-md text-sm text-primary-foreground/80">
            Open credits wait to apply to a bill. Applied ones are already used against payables.
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/purchases/vendor-credits/new"
            className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-accent"
          >
            <PlusIcon className="size-4" aria-hidden />
            New vendor credit
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2">
        {BANDS.map((band, index) => {
          const amount = home[band.field]
          const count = home[band.count]
          const on = active === band.key
          return (
            <Link
              key={band.key}
              href={listHref('/purchases/vendor-credits', {
                ...params,
                status: on ? undefined : band.key,
              })}
              aria-current={on ? 'true' : undefined}
              className={cn('px-5 py-4 sm:px-6', index > 0 && 'border-t sm:border-t-0 sm:border-l', on && 'bg-accent')}
            >
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {band.label}
              </p>
              <p className="mt-1 text-xl font-semibold tabular">{formatMoney(amount, currency)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {count === 1 ? '1 credit' : `${count} credits`}
              </p>
            </Link>
          )
        })}
      </div>

      <div className="px-5 pb-4 sm:px-6">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
          {BANDS.filter((band) => !new Decimal(home[band.field]).isZero()).map((band) => {
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
          })}
        </div>
        {home.draftCount > 0 ? (
          <Link
            href={listHref('/purchases/vendor-credits', {
              ...params,
              status: active === 'draft' ? undefined : 'draft',
            })}
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

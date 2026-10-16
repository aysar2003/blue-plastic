import Link from 'next/link'
import { PlusIcon } from 'lucide-react'

import { listHref } from '@/lib/list-filters'
import { MONEY_BAR } from '@/lib/money-bar-bands'
import { Decimal, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const BANDS = [
  { key: 'open', field: 'open', count: 'openCount', label: 'Open', bar: MONEY_BAR.orders.bar },
  { key: 'partial', field: 'partial', count: 'partialCount', label: 'Receiving', bar: MONEY_BAR.month.bar },
  { key: 'closed', field: 'closed', count: 'closedCount', label: 'Received', bar: MONEY_BAR.paid.bar },
] as const

export type PurchaseOrderHomeFigures = {
  open: string
  openCount: number
  partial: string
  partialCount: number
  closed: string
  closedCount: number
  draftTotal: string
  draftCount: number
}

/** Purchase orders dashboard — ordered, receiving, fully received. */
export function PurchaseOrderHome({
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
  home: PurchaseOrderHomeFigures
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
            Purchase orders
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary-foreground">
            Orders waiting for goods
          </h1>
          <p className="mt-1 max-w-md text-sm text-primary-foreground/80">
            Nothing posts until you receive. Open is not started; Receiving is partial; Received is
            complete.
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/purchases/purchase-orders/new"
            className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-accent"
          >
            <PlusIcon className="size-4" aria-hidden />
            New purchase order
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3">
        {BANDS.map((band, index) => {
          const amount = home[band.field]
          const count = home[band.count]
          const on = active === band.key
          return (
            <Link
              key={band.key}
              href={listHref('/purchases/purchase-orders', {
                ...params,
                status: on ? undefined : band.key,
              })}
              aria-current={on ? 'true' : undefined}
              className={cn(
                'px-5 py-4 sm:px-6',
                index > 0 && 'border-t sm:border-t-0 sm:border-l',
                on && 'bg-accent',
              )}
            >
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {band.label}
              </p>
              <p className="mt-1 text-xl font-semibold tabular">{formatMoney(amount, currency)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {count === 1 ? '1 order' : `${count} orders`}
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
            href={listHref('/purchases/purchase-orders', {
              ...params,
              status: active === 'draft' ? undefined : 'draft',
            })}
            className={cn(
              'mt-3 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline',
              active === 'draft' && 'font-medium text-foreground',
            )}
          >
            {home.draftCount === 1 ? '1 draft' : `${home.draftCount} drafts`} ·{' '}
            {formatMoney(home.draftTotal, currency)} not ordered yet
          </Link>
        ) : null}
      </div>
    </section>
  )
}

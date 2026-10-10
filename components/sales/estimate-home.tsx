import Link from 'next/link'
import { PlusIcon } from 'lucide-react'

import { listHref } from '@/lib/list-filters'
import { Decimal, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const BANDS = [
  { key: 'open', field: 'open', count: 'openCount', label: 'Open', bar: 'bg-[#5b6b82]' },
  { key: 'accepted', field: 'accepted', count: 'acceptedCount', label: 'Accepted', bar: 'bg-[#2f9e57]' },
  { key: 'declined', field: 'declined', count: 'declinedCount', label: 'Declined', bar: 'bg-[#e07a3d]' },
  { key: 'invoiced', field: 'invoiced', count: 'invoicedCount', label: 'Invoiced', bar: 'bg-[#8eb4d4]' },
] as const

export type EstimateHomeFigures = {
  open: string
  openCount: number
  accepted: string
  acceptedCount: number
  declined: string
  declinedCount: number
  invoiced: string
  invoicedCount: number
  draftTotal: string
  draftCount: number
}

/**
 * Home for estimates or quotations — header with New, four clickable status
 * bands that filter the list underneath, and a draft link.
 */
export function EstimateHome({
  currency,
  canCreate,
  active,
  params,
  home,
  basePath,
  singular,
  plural,
}: {
  currency: string
  canCreate: boolean
  active: string
  params: Record<string, string | undefined>
  home: EstimateHomeFigures
  basePath: string
  singular: string
  plural: string
}) {
  const barTotal = BANDS.reduce(
    (sum, band) => sum.plus(new Decimal(home[band.field]).abs()),
    new Decimal(0),
  )
  const unit = singular.toLowerCase()
  const units = plural.toLowerCase()

  return (
    <section className="mb-6 overflow-hidden rounded-2xl bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-16px_rgba(15,23,42,0.18)] ring-1 ring-border">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-primary px-5 py-6 text-primary-foreground sm:px-6">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">
            {plural}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primary-foreground">
            {plural} waiting on customers
          </h1>
          <p className="mt-1 max-w-md text-sm text-primary-foreground/80">
            Create a {unit}, send it, then convert to an invoice when they accept. Open is still
            out; invoiced means it already became a sale.
          </p>
        </div>
        {canCreate ? (
          <Link
            href={`${basePath}/new`}
            className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-accent"
          >
            <PlusIcon className="size-4" aria-hidden />
            New {unit}
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
              href={listHref(basePath, { ...params, status: on ? undefined : band.key })}
              aria-current={on ? 'true' : undefined}
              className={cn(
                'px-5 py-4 sm:px-6',
                index % 2 === 1 && 'border-l',
                index >= 2 && 'border-t lg:border-t-0',
                index > 0 && 'lg:border-l',
                on && 'bg-accent',
              )}
            >
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">{band.label}</p>
              <p className="mt-1 text-xl font-semibold tabular">{formatMoney(amount, currency)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {count === 1 ? `1 ${unit}` : `${count} ${units}`}
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
            href={listHref(basePath, { ...params, status: active === 'draft' ? undefined : 'draft' })}
            className={cn(
              'mt-3 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline',
              active === 'draft' && 'font-medium text-foreground',
            )}
          >
            {home.draftCount === 1 ? '1 draft' : `${home.draftCount} drafts`} ·{' '}
            {formatMoney(home.draftTotal, currency)} not sent
          </Link>
        ) : null}
      </div>
    </section>
  )
}

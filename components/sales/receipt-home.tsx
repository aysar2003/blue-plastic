import Link from 'next/link'
import { PlusIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { listHref } from '@/lib/list-filters'
import { Decimal, formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

const BANDS = [
  { key: 'today', label: 'Today', field: 'todayTotal', count: 'todayCount', bar: 'bg-[#2ca01c]' },
  { key: 'month', label: 'This month', field: 'monthTotal', count: 'monthCount', bar: 'bg-[#0b4f6c]' },
  { key: 'year', label: 'This year', field: 'yearTotal', count: 'yearCount', bar: 'bg-[#5ec8e5]' },
  { key: 'all', label: 'All dates', field: 'allTotal', count: 'allCount', bar: 'bg-[#c5c9ce]' },
] as const

export type ReceiptHomeFigures = {
  todayTotal: string
  todayCount: number
  monthTotal: string
  monthCount: number
  yearTotal: string
  yearCount: number
  allTotal: string
  allCount: number
}

export function ReceiptHome({
  currency,
  canCreate,
  active,
  params,
  home,
}: {
  currency: string
  canCreate: boolean
  /** The date preset currently narrowing the list. */
  active: string
  params: Record<string, string | undefined>
  home: ReceiptHomeFigures
}) {
  const today = new Decimal(home.todayTotal)
  const month = Decimal.max(new Decimal(home.monthTotal).minus(today), 0)
  const year = Decimal.max(new Decimal(home.yearTotal).minus(new Decimal(home.monthTotal)), 0)
  const older = Decimal.max(new Decimal(home.allTotal).minus(new Decimal(home.yearTotal)), 0)
  const slices = [
    { key: 'today', amount: today, bar: 'bg-[#2ca01c]', label: 'Today' },
    { key: 'month', amount: month, bar: 'bg-[#0b4f6c]', label: 'Rest of this month' },
    { key: 'year', amount: year, bar: 'bg-[#5ec8e5]', label: 'Rest of this year' },
    { key: 'older', amount: older, bar: 'bg-[#c5c9ce]', label: 'Earlier' },
  ].filter((slice) => !slice.amount.isZero())
  const barTotal = slices.reduce((sum, slice) => sum.plus(slice.amount), new Decimal(0))

  return (
    <section className="mb-6 overflow-hidden rounded-xl border bg-card">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales receipts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Paid on the spot, deposited straight into a bank account.</p>
        </div>
        {canCreate ? (
          <Link href="/sales/sales-receipts/new" className={cn(buttonVariants(), 'bg-[#2ca01c] hover:bg-[#248a18]')}>
            <PlusIcon /> New receipt
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4">
        {BANDS.map((band, index) => {
          const amount = home[band.field]
          const count = home[band.count]
          const on = active === band.key
          return (
            <Link
              key={band.key}
              href={listHref('/sales/sales-receipts', { ...params, date: on ? 'last3' : band.key })}
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
                {count === 1 ? '1 receipt' : `${count} receipts`}
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

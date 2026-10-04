import Link from 'next/link'
import { Decimal, formatMoney } from '@/lib/money'
import { bandDetail, type CustomerBand, type BandKey } from '@/lib/customer-bands'
import { cn } from '@/lib/utils'

const LOOK: Record<BandKey, { title: string; bar: string }> = {
  estimates: { title: 'Estimates', bar: 'bg-[#5ec8e5]' },
  overdue: { title: 'Overdue', bar: 'bg-[#d4652f]' },
  open: { title: 'Open', bar: 'bg-[#c5c9ce]' },
  paid: { title: 'Recently paid', bar: 'bg-[#2ca01c]' },
}

/**
 * The strip above the customer list. Each block is a filter: click Overdue and
 * the list shows only the customers who have an invoice past its due date.
 */
export function CustomerMoneyBar({
  bands,
  currency,
  active,
  baseQuery,
}: {
  bands: CustomerBand[]
  currency: string
  active?: BandKey
  baseQuery: Record<string, string | undefined>
}) {
  const total = bands.reduce((sum, band) => sum.plus(new Decimal(band.amount).abs()), new Decimal(0))

  const hrefFor = (key: BandKey) => {
    const next = new URLSearchParams()
    for (const [name, value] of Object.entries(baseQuery)) {
      if (value) next.set(name, value)
    }
    if (active !== key) next.set('band', key)
    const query = next.toString()
    return query ? `/customers?${query}` : '/customers'
  }

  return (
    <div className="mb-3 bg-[#f4f8fb] px-5 py-4">
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {bands.map((band) => {
          const look = LOOK[band.key]
          const selected = active === band.key
          return (
            <Link
              key={band.key}
              href={hrefFor(band.key)}
              className={cn('rounded-md px-1 py-1', selected && 'bg-white shadow-sm ring-1 ring-border')}
              aria-current={selected ? 'true' : undefined}
            >
              <p className="tabular text-2xl font-medium leading-none tracking-tight">{formatMoney(band.amount, currency)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="sr-only">{look.title}. </span>
                {bandDetail(band)}
              </p>
            </Link>
          )
        })}
      </div>
      <div className="mt-4 flex h-2.5 overflow-hidden bg-[#e7edf2]">
        {bands.map((band) => {
          const amount = new Decimal(band.amount).abs()
          if (amount.isZero()) return null
          const share = total.isZero() ? 0 : amount.dividedBy(total).times(100).toNumber()
          return (
            <span
              key={band.key}
              className={LOOK[band.key].bar}
              style={{ width: `${Math.max(share, 1.5)}%` }}
              title={`${LOOK[band.key].title}: ${formatMoney(band.amount, currency)}`}
            />
          )
        })}
      </div>
    </div>
  )
}

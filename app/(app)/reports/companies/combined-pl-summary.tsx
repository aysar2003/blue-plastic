import { Card } from '@/components/ui/card'
import { formatSigned, type Decimal } from '@/lib/money'
import { cn } from '@/lib/utils'

type Total = {
  currency: string
  income: Decimal
  expenses: Decimal
  netIncome: Decimal
  companies: number
}

/** Headline profit and loss for the combined group (same-currency totals only). */
export function CombinedPlSummary({
  totals,
  label,
}: {
  totals: Total[]
  label: string
}) {
  if (totals.length === 0) return null

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {totals.map((total) => (
        <Card key={total.currency} className="space-y-3 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label} · {total.currency}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {total.companies} {total.companies === 1 ? 'company' : 'companies'} · same currency
            </p>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Income</dt>
              <dd className="tabular-nums font-medium">
                {formatSigned(total.income, total.currency)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Expenses</dt>
              <dd className="tabular-nums font-medium">
                {formatSigned(total.expenses, total.currency)}
              </dd>
            </div>
            <div
              className={cn(
                'flex items-baseline justify-between gap-3 border-t pt-2',
                total.netIncome.isNegative() ? 'text-destructive' : 'text-foreground',
              )}
            >
              <dt className="font-semibold">Net income</dt>
              <dd className="tabular-nums text-base font-semibold">
                {formatSigned(total.netIncome, total.currency)}
              </dd>
            </div>
          </dl>
        </Card>
      ))}
    </div>
  )
}

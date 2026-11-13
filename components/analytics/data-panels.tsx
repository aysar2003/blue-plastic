import Link from 'next/link'

import {
  EXPENSE_COLOR,
  INCOME_COLOR,
  NET_COLOR,
} from '@/components/reports/figure-chart'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export function ProfitSplitBars({
  income,
  expenses,
  net,
  currency,
}: {
  income: string
  expenses: string
  net: string
  currency: string
}) {
  const bars = [
    { label: 'Income', value: Number(income), color: INCOME_COLOR, amount: income },
    { label: 'Expenses', value: Number(expenses), color: EXPENSE_COLOR, amount: expenses },
    { label: 'Net', value: Number(net), color: NET_COLOR, amount: net },
  ]
  const peak = Math.max(1, ...bars.map((b) => Math.abs(b.value)))

  return (
    <ul className="space-y-3">
      {bars.map((bar) => {
        const width = Math.max(2, (Math.abs(bar.value) / peak) * 100)
        return (
          <li key={bar.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">{bar.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatMoney(bar.amount, currency)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${width}%`,
                  background: bar.color,
                  marginLeft: bar.value < 0 ? `${100 - width}%` : 0,
                }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function CollectionProgress({
  paid,
  deposited,
  notDeposited,
  depositedShare,
  currency,
}: {
  paid: string
  deposited: string
  notDeposited: string
  depositedShare: number
  currency: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Collected this period</p>
          <p className="text-lg font-semibold tabular-nums">{formatMoney(paid, currency)}</p>
        </div>
        <p className="text-xs text-muted-foreground">{Math.round(depositedShare)}% deposited</p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted/60">
        <div
          className="h-full rounded-full"
          style={{ width: `${depositedShare}%`, background: INCOME_COLOR }}
        />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-muted/40 px-2.5 py-2">
          <dt className="text-muted-foreground">Deposited</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{formatMoney(deposited, currency)}</dd>
        </div>
        <div className="rounded-lg bg-muted/40 px-2.5 py-2">
          <dt className="text-muted-foreground">Not deposited</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{formatMoney(notDeposited, currency)}</dd>
        </div>
      </dl>
    </div>
  )
}

export function BankAccountsPanel({
  banks,
  currency,
  total,
}: {
  banks: { id: string; name: string; balance: string; subtype: string }[]
  currency: string
  total: string
}) {
  if (banks.length === 0) {
    return <p className="text-sm text-muted-foreground">No bank accounts yet.</p>
  }
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs text-muted-foreground">{banks.length} accounts</p>
        <p className="text-sm font-semibold tabular-nums">{formatMoney(total, currency)}</p>
      </div>
      <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
        {banks.map((bank) => (
          <li key={bank.id}>
            <Link
              href="/banking/accounts"
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium text-foreground">{bank.name}</span>
                <span className="ml-2 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  {bank.subtype === 'UNDEPOSITED_FUNDS' ? 'undeposited' : 'bank'}
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 tabular-nums',
                  Number(bank.balance) < 0 ? 'text-[color:var(--chart-expense,#C2410C)]' : 'text-foreground',
                )}
              >
                {formatMoney(bank.balance, currency)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TopSalesDaysPanel({
  days,
  currency,
}: {
  days: { day: string; amount: string }[]
  currency: string
}) {
  if (days.length === 0) {
    return <p className="text-sm text-muted-foreground">No sales days in this month.</p>
  }
  const peak = Math.max(1, ...days.map((d) => Number(d.amount)))
  return (
    <ul className="space-y-2">
      {days.map((day, index) => (
        <li key={day.day} className="flex items-center gap-2 text-sm">
          <span className="w-4 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex justify-between gap-2">
              <span className="truncate text-foreground">{formatDate(day.day)}</span>
              <span className="shrink-0 tabular-nums font-medium">
                {formatMoney(day.amount, currency)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(Number(day.amount) / peak) * 100}%`,
                  background: NET_COLOR,
                }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function MetricsTable({
  rows,
}: {
  rows: { key: string; label: string; value: string; unit: string }[]
}) {
  return (
    <div className="max-h-64 overflow-auto rounded-xl border border-border/60">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-muted/80 text-[0.65rem] uppercase tracking-wide text-muted-foreground backdrop-blur">
          <tr>
            <th className="px-3 py-2 font-medium">Metric</th>
            <th className="px-3 py-2 font-medium">Value</th>
            <th className="px-3 py-2 font-medium">Unit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border/50">
              <td className="px-3 py-1.5 text-foreground">{row.label}</td>
              <td className="px-3 py-1.5 font-medium tabular-nums text-foreground">{row.value}</td>
              <td className="px-3 py-1.5 text-xs text-muted-foreground">{row.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

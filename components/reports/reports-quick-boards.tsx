import Link from 'next/link'

import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

type Board = {
  href: string
  label: string
  blurb: string
  accent: string
}

const BOARDS: Board[] = [
  {
    href: '/reports/snapshot',
    label: 'Company Snapshot',
    blurb: 'Company · payments · customer',
    accent: '#0E7490',
  },
  {
    href: '/reports/business-overview',
    label: 'Business overview',
    blurb: 'Cash, profit, unpaid',
    accent: '#0F766E',
  },
  {
    href: '/analytics',
    label: 'Analytics',
    blurb: 'Charts and KPIs',
    accent: '#0369A1',
  },
  {
    href: '/reports/profit-loss?period=this-month',
    label: 'Profit and Loss',
    blurb: 'This month',
    accent: '#15803D',
  },
]

export function ReportsQuickBoards({
  showOverview,
  monthPulse,
  currency,
}: {
  showOverview: boolean
  monthPulse: { income: string; expenses: string; net: string }
  currency: string
}) {
  const boards = showOverview ? BOARDS : BOARDS.filter((b) => b.href.startsWith('/reports/profit-loss'))

  return (
    <div className="mb-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {boards.map((board, index) => (
          <Link
            key={board.href}
            href={board.href}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <span
              aria-hidden
              className="app-chroma-bar absolute inset-x-0 top-0 h-1"
              style={{ background: board.accent }}
            />
            <p className="text-sm font-semibold text-foreground group-hover:text-primary">
              {board.label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{board.blurb}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/60 bg-card/80 p-4 sm:grid-cols-3">
        <PulseStat label="Income · this month" value={formatMoney(monthPulse.income, currency)} tone="up" />
        <PulseStat
          label="Expenses · this month"
          value={formatMoney(monthPulse.expenses, currency)}
          tone="down"
        />
        <PulseStat
          label="Net · this month"
          value={formatMoney(monthPulse.net, currency)}
          tone={Number(monthPulse.net) >= 0 ? 'up' : 'down'}
          href="/reports/profit-loss?period=this-month&compare=prior-period"
        />
      </div>
    </div>
  )
}

function PulseStat({
  label,
  value,
  tone,
  href,
}: {
  label: string
  value: string
  tone: 'up' | 'down'
  href?: string
}) {
  const body = (
    <>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-xl font-bold tabular-nums tracking-tight',
          tone === 'up' && 'text-emerald-700 dark:text-emerald-300',
          tone === 'down' && 'text-rose-700 dark:text-rose-300',
        )}
      >
        {value}
      </p>
    </>
  )
  if (!href) return <div>{body}</div>
  return (
    <Link href={href} className="block rounded-xl transition hover:bg-muted/40">
      {body}
    </Link>
  )
}

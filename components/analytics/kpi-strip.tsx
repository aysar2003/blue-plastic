import Link from 'next/link'

import { Sparkline } from '@/components/analytics/sparkline'
import { cn } from '@/lib/utils'

const ACCENTS = [
  'var(--chart-net, #0369A1)',
  'var(--chart-income, #0F766E)',
  'var(--chart-expense, #C2410C)',
  '#7C3AED',
  '#0891B2',
  '#CA8A04',
]

export function AnalyticsKpiStrip({
  items,
}: {
  items: {
    key: string
    label: string
    value: string
    hint?: string
    href: string
    tone?: 'up' | 'down' | 'flat'
    spark?: number[]
  }[]
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
      {items.map((item, index) => {
        const accent = ACCENTS[index % ACCENTS.length]!
        const sparkColor =
          item.tone === 'down'
            ? 'var(--chart-expense, #C2410C)'
            : item.tone === 'up'
              ? 'var(--chart-income, #0F766E)'
              : accent
        return (
          <li key={item.key} style={{ animationDelay: `${index * 20}ms` }} className="analytics-fade-in">
            <Link
              href={item.href}
              className="group relative block h-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_8px_28px_rgba(15,23,42,0.08)]"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: accent }}
              />
              <div className="flex items-start justify-between gap-2 px-3.5 pb-3 pt-3.5">
                <div className="min-w-0">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-foreground">
                    {item.value}
                  </p>
                  {item.hint ? (
                    <p
                      className={cn(
                        'mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium',
                        item.tone === 'up' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                        item.tone === 'down' && 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
                        (!item.tone || item.tone === 'flat') && 'bg-muted text-muted-foreground',
                      )}
                    >
                      {item.tone === 'up' ? '↑' : item.tone === 'down' ? '↓' : '·'} {item.hint}
                    </p>
                  ) : null}
                </div>
                {item.spark && item.spark.length > 1 ? (
                  <Sparkline values={item.spark} color={sparkColor} className="mt-1 h-8 w-16 shrink-0 opacity-90" />
                ) : null}
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

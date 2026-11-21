import Link from 'next/link'

import { WidgetBody } from '@/components/snapshots/widget-frame'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { SnapshotPulse, WidgetResult } from '@/server/services/company-snapshot.service'

export function SnapshotPulseStrip({
  pulse,
  currency,
}: {
  pulse: WidgetResult<SnapshotPulse>
  currency: string
}) {
  return (
    <WidgetBody result={pulse} empty="">
      {(data) => {
        const net = Number(data.netMtd)
        const items = [
          {
            key: 'cash',
            label: 'Cash & undeposited',
            value: formatMoney(data.cash, currency),
            href: '/banking',
            tone: 'flat' as const,
          },
          {
            key: 'ar',
            label: 'Open A/R',
            value: formatMoney(data.openAr, currency),
            href: '/reports/ar-aging',
            tone: 'flat' as const,
          },
          {
            key: 'overdue',
            label: 'Overdue',
            value: formatMoney(data.overdue, currency),
            href: '/reports/collections',
            tone: Number(data.overdue) > 0 ? ('down' as const) : ('flat' as const),
          },
          {
            key: 'paid',
            label: 'Collected MTD',
            value: formatMoney(data.paidMtd, currency),
            href: '/payments',
            tone: 'up' as const,
          },
          {
            key: 'net',
            label: 'Net profit MTD',
            value: formatMoney(data.netMtd, currency),
            href: '/reports/profit-loss',
            tone: net > 0 ? ('up' as const) : net < 0 ? ('down' as const) : ('flat' as const),
          },
          {
            key: 'stock',
            label: 'Stock value',
            value: formatMoney(data.stockValue, currency),
            href: '/inventory/stock',
            tone: 'flat' as const,
          },
          {
            key: 'jobs',
            label: 'Open jobs',
            value: data.openJobs,
            href: '/service/jobs',
            tone: 'flat' as const,
          },
          {
            key: 'van',
            label: 'Van stock',
            value: formatMoney(data.vanStock, currency),
            href: '/inventory/stock',
            tone: 'flat' as const,
          },
        ]
        return (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item, index) => (
              <li
                key={item.key}
                className="snapshot-fade-in"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <Link
                  href={item.href}
                  className="group block h-full overflow-hidden rounded-2xl border border-border/60 bg-card/95 px-3.5 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
                >
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-xl font-bold tabular-nums tracking-tight',
                      item.tone === 'up' && 'text-emerald-700 dark:text-emerald-300',
                      item.tone === 'down' && 'text-rose-700 dark:text-rose-300',
                    )}
                  >
                    {item.value}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )
      }}
    </WidgetBody>
  )
}

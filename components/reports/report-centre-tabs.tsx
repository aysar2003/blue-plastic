import Link from 'next/link'

import { REPORT_CENTRE_TABS } from '@/lib/standard-reports'
import { cn } from '@/lib/utils'

export function ReportCentreTabs({ active }: { active: (typeof REPORT_CENTRE_TABS)[number]['key'] }) {
  return (
    <nav
      aria-label="Report centre"
      className="mb-5 flex flex-wrap gap-1.5 rounded-2xl border border-border/60 bg-muted/30 p-1.5 print:hidden"
    >
      {REPORT_CENTRE_TABS.map((tab) => {
        const on = tab.key === active
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'rounded-xl px-3.5 py-2 text-sm transition',
              on
                ? 'bg-card font-semibold text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-card/70 hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

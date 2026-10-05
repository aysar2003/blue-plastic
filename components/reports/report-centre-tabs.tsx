import Link from 'next/link'

import { REPORT_CENTRE_TABS } from '@/lib/standard-reports'
import { cn } from '@/lib/utils'

export function ReportCentreTabs({ active }: { active: (typeof REPORT_CENTRE_TABS)[number]['key'] }) {
  return (
    <nav aria-label="Report centre" className="mb-4 flex gap-1 overflow-x-auto border-b print:hidden">
      {REPORT_CENTRE_TABS.map((tab) => {
        const on = tab.key === active
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2 text-sm',
              on
                ? 'border-primary font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

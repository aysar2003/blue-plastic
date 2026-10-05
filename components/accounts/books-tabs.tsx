import Link from 'next/link'

import { cn } from '@/lib/utils'

const TABS = [
  { key: 'bank', href: '/banking/accounts', label: 'Bank transactions' },
  { key: 'app', href: '/banking/import', label: 'App transactions' },
  { key: 'reconcile', href: '/banking/reconcile', label: 'Reconcile' },
  { key: 'rules', href: '/banking/rules', label: 'Rules' },
  { key: 'chart', href: '/accounts', label: 'Chart of accounts' },
  { key: 'recurring', href: '/banking/recurring', label: 'Recurring transactions' },
] as const

export type BooksTab = (typeof TABS)[number]['key']

/** The banking and accounting strip above the chart, the bank list, and the rules. */
export function BooksTabs({ active }: { active: BooksTab }) {
  return (
    <nav aria-label="Banking and accounts" className="mb-4 flex gap-1 overflow-x-auto border-b print:hidden">
      {TABS.map((tab) => {
        const on = tab.key === active
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2 text-sm',
              on
                ? 'border-primary font-semibold text-primary'
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

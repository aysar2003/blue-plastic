'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

export function ApprovalsNav({
  pending,
  approved,
  canConfigure,
}: {
  pending: number
  approved: number
  canConfigure: boolean
}) {
  const pathname = usePathname()
  const tabs = [
    { href: '/approvals', label: 'Pending', count: pending, exact: true },
    { href: '/approvals/approved', label: 'All approved', count: approved, exact: false },
    ...(canConfigure
      ? [{ href: '/approvals/workflows', label: 'Workflows', count: null as number | null, exact: false }]
      : []),
  ]

  return (
    <nav
      className="mb-4 flex flex-wrap gap-1 border-b border-border pb-px print:hidden"
      aria-label="Approvals"
    >
      {tabs.map((tab) => {
        const on = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition',
              on
                ? 'border-primary font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.count != null ? (
              <span className="ml-1.5 tabular-nums text-xs text-muted-foreground">{tab.count}</span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

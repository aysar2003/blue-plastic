'use client'

import Link from 'next/link'
import { ChevronDownIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { withoutBusinessOverview } from '@/lib/business-overview-access'

const STARTS = [
  { href: '/reports/profit-loss', label: 'Profit and Loss' },
  { href: '/reports/balance-sheet', label: 'Balance Sheet' },
  { href: '/reports/cash-flow', label: 'Statement of Cash Flows' },
  { href: '/reports/invoice-list', label: 'Invoice List' },
  { href: '/reports/bill-list', label: 'Bill List' },
  { href: '/reports/sales-by-customer', label: 'Sales by Customer' },
  { href: '/reports/business-overview', label: 'Business overview' },
]

/** Opens an existing report. A custom report here is a saved favourite, not a second engine. */
export function reportMenuItems(permissions: Iterable<string>) {
  return withoutBusinessOverview(STARTS, permissions)
}

export function CreateReportMenu({ permissions }: { permissions: Iterable<string> }) {
  const starts = reportMenuItems(permissions)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ size: 'sm' })}>
        Create new report
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {starts.map((report) => (
          <DropdownMenuItem key={report.href} asChild>
            <Link href={report.href}>{report.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

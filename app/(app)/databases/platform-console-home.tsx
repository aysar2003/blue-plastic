import Link from 'next/link'
import {
  Building2Icon,
  CreditCardIcon,
  LayoutGridIcon,
  PlusIcon,
  UploadIcon,
  UsersIcon,
} from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PlatformConsoleHome({
  companyCount,
  pendingSignups,
  pendingRent,
  pendingAppRequests,
}: {
  companyCount: number
  pendingSignups: number
  pendingRent: number
  pendingAppRequests: number
}) {
  const attention = pendingSignups + pendingRent + pendingAppRequests

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-indigo-500/15 bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 text-white shadow-sm">
        <div className="flex flex-col gap-6 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-7 sm:py-7">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-indigo-200/90">
              Operations
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              Platform console
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-indigo-100/85">
              Create and open companies, review signup and rent requests, and control access for
              this installation — separate from day-to-day company books.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/databases?create=1"
              className={cn(
                buttonVariants({ size: 'sm' }),
                'border-0 bg-white text-indigo-950 hover:bg-indigo-50',
              )}
            >
              <PlusIcon />
              Create company
            </Link>
            <Link
              href="/databases?import=1"
              className={cn(
                buttonVariants({ size: 'sm', variant: 'outline' }),
                'border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white',
              )}
            >
              <UploadIcon />
              Import backup
            </Link>
            <Link
              href="/databases/apps"
              className={cn(
                buttonVariants({ size: 'sm', variant: 'outline' }),
                'border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white',
              )}
            >
              <LayoutGridIcon />
              Apps
            </Link>
            <Link
              href="/databases/billing"
              className={cn(
                buttonVariants({ size: 'sm', variant: 'outline' }),
                'border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white',
              )}
            >
              <CreditCardIcon />
              Billing
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Companies"
          value={companyCount}
          href="/databases"
          icon={Building2Icon}
        />
        <StatCard
          label="Signup requests"
          value={pendingSignups}
          href="#pending-signups"
          icon={UsersIcon}
          highlight={pendingSignups > 0}
        />
        <StatCard
          label="Rent to review"
          value={pendingRent}
          href="#pending-rent"
          icon={CreditCardIcon}
          highlight={pendingRent > 0}
        />
        <StatCard
          label="App requests"
          value={pendingAppRequests}
          href="/databases/apps#pending-apps"
          icon={LayoutGridIcon}
          highlight={pendingAppRequests > 0}
        />
      </div>

      {attention > 0 ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{attention}</span> item
          {attention === 1 ? '' : 's'} need attention below.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No pending requests — queue is clear.</p>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  href,
  icon: Icon,
  highlight = false,
}: {
  label: string
  value: number
  href: string
  icon: React.ComponentType<{ className?: string }>
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/40',
        highlight
          ? 'border-indigo-500/35 ring-1 ring-indigo-500/15'
          : 'border-border/80',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
    </Link>
  )
}

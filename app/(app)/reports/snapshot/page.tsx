import type { Metadata } from 'next'
import Link from 'next/link'

import { CompanyTab } from '@/components/snapshots/company-tab'
import { CustomerTab } from '@/components/snapshots/customer-tab'
import { PaymentsTab } from '@/components/snapshots/payments-tab'
import { SnapshotPulseStrip } from '@/components/snapshots/pulse-strip'
import { AccessDenied } from '@/components/system/access-denied'
import {
  canViewBusinessOverview,
  COMPANY_SNAPSHOT_HREF,
} from '@/lib/business-overview-access'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { requireOrgContext } from '@/server/auth/context'
import {
  isSnapshotTab,
  loadCompanySnapshot,
  type SnapshotTab,
} from '@/server/services/company-snapshot.service'

export const metadata: Metadata = { title: 'Company Snapshot' }

const TABS: { key: SnapshotTab; label: string; blurb: string }[] = [
  { key: 'company', label: 'Company', blurb: 'P&L pulse and who owes you' },
  { key: 'payments', label: 'Payments', blurb: 'Collections and A/R' },
  { key: 'customer', label: 'Customer', blurb: '360° one customer' },
]

export default async function CompanySnapshotPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; customerId?: string }>
}) {
  const ctx = await requireOrgContext()
  if (!canViewBusinessOverview(ctx.permissions)) {
    return <AccessDenied section="Company Snapshot" />
  }

  const query = await searchParams
  const tab: SnapshotTab = isSnapshotTab(query.tab) ? query.tab : 'company'
  const snapshot = await loadCompanySnapshot(ctx, {
    tab,
    customerId: query.customerId,
  })

  return (
    <div className="snapshot-board relative min-h-[70vh] pb-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_110%_70%_at_0%_-10%,color-mix(in_oklab,#0E7490_12%,transparent),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_0%,color-mix(in_oklab,#0F766E_10%,transparent),transparent_45%)]"
      />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="snapshot-fade-in">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {snapshot.organizationName}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Company Snapshot
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Live management board · as at {formatDate(snapshot.asOf)} · every figure from the ledger
            — safer and clearer than the classic QuickBooks centre.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs snapshot-fade-in">
          <Link
            href="/analytics"
            className="rounded-full border bg-card/90 px-3 py-1.5 font-medium shadow-sm hover:border-primary/30"
          >
            Analytics
          </Link>
          <Link
            href="/reports/business-overview"
            className="rounded-full border bg-card/90 px-3 py-1.5 font-medium shadow-sm hover:border-primary/30"
          >
            Business overview
          </Link>
        </div>
      </div>

      <div className="mb-5">
        <SnapshotPulseStrip pulse={snapshot.pulse} currency={snapshot.currency} />
      </div>

      <nav
        aria-label="Snapshot views"
        className="sticky top-0 z-10 mb-5 -mx-1 flex gap-1 overflow-x-auto border-b border-border/70 bg-background/85 px-1 backdrop-blur-md print:hidden"
      >
        {TABS.map((item) => {
          const on = item.key === snapshot.tab
          const href =
            item.key === 'customer' && snapshot.customerId
              ? `${COMPANY_SNAPSHOT_HREF}?tab=customer&customerId=${encodeURIComponent(snapshot.customerId)}`
              : `${COMPANY_SNAPSHOT_HREF}?tab=${item.key}`
          return (
            <Link
              key={item.key}
              href={href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'shrink-0 border-b-2 px-3 py-2.5 transition',
                on
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <span className={cn('block text-sm', on && 'font-semibold')}>{item.label}</span>
              <span className="block text-[0.65rem] text-muted-foreground">{item.blurb}</span>
            </Link>
          )
        })}
      </nav>

      {snapshot.tab === 'company' && snapshot.company ? (
        <CompanyTab board={snapshot.company} currency={snapshot.currency} />
      ) : null}
      {snapshot.tab === 'payments' && snapshot.payments ? (
        <PaymentsTab board={snapshot.payments} currency={snapshot.currency} />
      ) : null}
      {snapshot.tab === 'customer' && snapshot.customer ? (
        <CustomerTab
          board={snapshot.customer}
          currency={snapshot.currency}
          selectedId={snapshot.customerId}
        />
      ) : null}
    </div>
  )
}

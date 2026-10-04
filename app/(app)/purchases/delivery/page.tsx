import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { PackageCheckIcon, PackageIcon, PackageOpenIcon, PackageXIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { DELIVERY_HUB_APPS, visibleHubApps } from '@/components/layout/module-hubs'
import { DeliveryOrderTable } from '@/components/purchases/delivery-order-table'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as delivery from '@/server/services/delivery.service'

export const metadata: Metadata = { title: 'Delivery' }

/**
 * Delivery lives inside Purchases: orders placed, goods that arrived, and what
 * is still on the road. The dashboard is the front door; the tiles open the
 * lists and the full line report.
 */
export default async function DeliveryHubPage() {
  const ctx = await requireOrgContext('bill:read')
  const apps = visibleHubApps(DELIVERY_HUB_APPS, ctx.permissions)
  const summary = await delivery.overview(ctx)
  const currency = ctx.organization.baseCurrency
  const canReceive = ctx.permissions.has('bill:create')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery"
        description="What was ordered, what has arrived, and what is still outstanding — order by order."
        actions={
          canReceive ? (
            <Link
              href="/purchases/purchase-orders?status=open"
              className={buttonVariants({ size: 'sm' })}
            >
              <PackageIcon /> Receive items
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Insight
          label="Not delivered"
          value={String(summary.notDelivered)}
          hint="nothing received yet"
          href="/purchases/delivery/outstanding?bucket=not_delivered"
          icon={<PackageXIcon className="size-4 text-slate-500" />}
        />
        <Insight
          label="Part delivered"
          value={String(summary.partial)}
          hint="some lines still open"
          href="/purchases/delivery/outstanding?bucket=partial"
          icon={<PackageOpenIcon className="size-4 text-amber-700" />}
        />
        <Insight
          label="Delivered"
          value={String(summary.delivered)}
          hint="orders complete"
          href="/purchases/delivery/received"
          icon={<PackageCheckIcon className="size-4 text-emerald-700" />}
        />
        <Insight
          label="Outstanding value"
          value={formatMoney(summary.outstandingValue, currency)}
          hint={`${summary.outstandingQty} units still due`}
          href="/purchases/delivery/outstanding"
          icon={<PackageIcon className="size-4 text-sky-700" />}
        />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Delivery work</h2>
          <p className="text-sm text-muted-foreground">
            Receive goods, watch what is outstanding, and open the full line report.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {apps.map((app) => (
            <li key={app.key}>
              <Link
                href={app.href}
                className="flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <span
                  className="mb-3 inline-flex size-9 items-center justify-center rounded-lg"
                  style={{ background: app.wash, color: app.accent }}
                >
                  <PackageIcon className="size-4" />
                </span>
                <span className="font-medium">{app.label}</span>
                <span className="mt-0.5 text-xs text-muted-foreground">{app.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Outstanding deliveries</h2>
            <p className="text-sm text-muted-foreground">
              Orders that still have quantity to receive. Open Receive to book in part or all of a line.
            </p>
          </div>
          <Link
            href="/purchases/delivery/outstanding"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            View all outstanding
          </Link>
        </div>

        {summary.recentOutstanding.length === 0 ? (
          <EmptyState
            icon={PackageCheckIcon}
            title="Nothing outstanding"
            description="Every purchase order that is not a draft has been fully received — or none have been placed yet."
            action={
              <Link
                href="/purchases/purchase-orders/new"
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                New purchase order
              </Link>
            }
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <ScrollSheet>
              <DeliveryOrderTable rows={summary.recentOutstanding} currency={currency} />
            </ScrollSheet>
          </Card>
        )}
      </section>
    </div>
  )
}

function Insight({
  label,
  value,
  hint,
  href,
  icon,
}: {
  label: string
  value: string
  hint: string
  href: string
  icon: ReactNode
}) {
  return (
    <Link href={href} className="block rounded-xl border bg-card transition-colors hover:bg-muted/40">
      <Card className="border-0 shadow-none">
        <CardContent className="flex items-start gap-3 p-4">
          <span className="mt-0.5 rounded-md bg-muted p-2">{icon}</span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="tabular mt-0.5 text-lg font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

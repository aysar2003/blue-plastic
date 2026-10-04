import type { Metadata } from 'next'
import Link from 'next/link'
import { PackageCheckIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { DeliveryOrderTable } from '@/components/purchases/delivery-order-table'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import * as delivery from '@/server/services/delivery.service'

export const metadata: Metadata = { title: 'Delivered orders' }

export default async function DeliveredOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('bill:read')
  const search = await searchParams
  const vendorId = typeof search.vendorId === 'string' ? search.vendorId : undefined
  const rows = await delivery.listOrders(ctx, 'delivered', { vendorId })
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Delivered"
        description="Purchase orders where every line has been received. The bills raised for those deliveries are on each order."
        actions={
          <Link href="/purchases/delivery" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Delivery home
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={PackageCheckIcon}
          title="No complete deliveries yet"
          description="When an order is fully received it lands here. Part deliveries stay under Outstanding until the rest arrives."
          action={
            <Link
              href="/purchases/delivery/outstanding"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Outstanding delivery
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ScrollSheet>
            <DeliveryOrderTable rows={rows} currency={currency} showReceive={false} />
          </ScrollSheet>
        </Card>
      )}
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { PackageIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { FilterChips } from '@/components/data/filter-chips'
import { PageHeader } from '@/components/data/page-header'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { DeliveryOrderTable } from '@/components/purchases/delivery-order-table'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import * as delivery from '@/server/services/delivery.service'

export const metadata: Metadata = { title: 'Outstanding delivery' }

const BUCKETS = [
  { value: '', label: 'All outstanding' },
  { value: 'not_delivered', label: 'Not delivered' },
  { value: 'partial', label: 'Part delivered' },
]

export default async function OutstandingDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('bill:read')
  const search = await searchParams
  const bucketRaw = typeof search.bucket === 'string' ? search.bucket : ''
  const bucket =
    bucketRaw === 'not_delivered' || bucketRaw === 'partial' ? bucketRaw : ''
  const vendorId = typeof search.vendorId === 'string' ? search.vendorId : undefined

  const rows = await delivery.listOrders(
    ctx,
    bucket === '' ? 'outstanding' : bucket,
    { vendorId },
  )
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Outstanding delivery"
        description="Purchase orders that still have quantity to receive — nothing yet, or only part of the order."
        actions={
          <Link href="/purchases/delivery" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Delivery home
          </Link>
        }
      />

      <div className="mb-3">
        <FilterChips
          options={BUCKETS}
          active={bucket}
          path="/purchases/delivery/outstanding"
          param="bucket"
          params={{ vendorId }}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title="Nothing outstanding"
          description="Every order in this filter has been fully received."
          action={
            <Link
              href="/purchases/delivery/received"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              See delivered orders
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ScrollSheet>
            <DeliveryOrderTable rows={rows} currency={currency} />
          </ScrollSheet>
        </Card>
      )}
    </>
  )
}

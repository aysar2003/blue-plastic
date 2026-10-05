import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PackageIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { DeliveryOrderTable } from '@/components/purchases/delivery-order-table'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import * as delivery from '@/server/services/delivery.service'
import * as storeService from '@/server/services/store.service'

export const metadata: Metadata = { title: 'Receive into store' }

export default async function StoreReceivePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext('bill:read')
  const { id } = await params

  const [board, stores] = await Promise.all([
    storeService.dashboard(ctx, id).catch(() => null),
    storeService.columns(ctx),
  ])
  if (!board) notFound()

  const officeStoreId = stores.find((store) => store.isOffice)?.id ?? id
  const returnTo = `/stores/${id}/receive`
  const raw = await delivery.listOrders(ctx, 'outstanding', {
    storeId: id,
    officeStoreId,
  })
  const rows = raw.map((row) => ({
    ...row,
    receiveHref: `${row.receiveHref}?return=${encodeURIComponent(returnTo)}`,
  }))
  const currency = ctx.organization.baseCurrency
  const canReceive = ctx.permissions.has('bill:create')

  return (
    <>
      <PageHeader
        title={`Receive · ${board.store.name}`}
        description="Purchase orders with goods still to arrive for this store. Open Receive on an order — same screen as Purchases — and enter what came in today."
        actions={
          <Link href={`/stores/${id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back to store
          </Link>
        }
      />

      {!canReceive ? (
        <p className="mb-4 text-sm text-muted-foreground">
          You can see what is due. Recording a receipt needs permission to create bills.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title="No orders to receive for this store"
          description="When a purchase order names this store on its lines and something is still outstanding, it appears here."
          action={
            <Link href="/purchases/delivery/outstanding" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              All outstanding orders
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ScrollSheet>
            <DeliveryOrderTable rows={rows} currency={currency} showReceive={canReceive} />
          </ScrollSheet>
        </Card>
      )}
    </>
  )
}

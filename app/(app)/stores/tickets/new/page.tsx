import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { StoreTicketForm } from '@/components/inventory/store-ticket-form'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import * as inventoryService from '@/server/services/inventory.service'
import * as storeService from '@/server/services/store.service'

export const metadata: Metadata = { title: 'New store ticket' }

export default async function NewStoreTicketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('inventory:adjust')
  const query = await searchParams
  const fromParam = typeof query.from === 'string' ? query.from : undefined
  const itemParam = typeof query.item === 'string' ? query.item : undefined

  const [stores, stock, shelf, documentNumber] = await Promise.all([
    storeService.columns(ctx),
    inventoryService.stockOnHand(ctx),
    storeService.quantities(ctx),
    peekDocumentNumber(db, ctx.orgId, 'STORE_TICKET'),
  ])

  const initialStoreId = stores.some((store) => store.id === fromParam) ? fromParam : stores[0]?.id
  const items = stock.items.map((item) => ({
    id: item.itemId,
    label: item.name,
    onHand: item.quantity.toFixed(2),
  }))
  const initialItemId = items.some((item) => item.id === itemParam) ? itemParam : undefined

  return (
    <>
      <PageHeader
        title="New store ticket"
        description="Record goods taken from a store. Add several items on one ticket — each line is numbered and stock moves to the destination store."
        actions={
          initialStoreId ? (
            <Link href={`/stores/${initialStoreId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Back to store
            </Link>
          ) : null
        }
      />
      {stores.length < 2 ? (
        <Card tone="warning">
          <CardContent className="space-y-3 p-4 text-sm">
            <p>You need at least two stores before a ticket can move stock.</p>
            <Link href="/stores" className={buttonVariants({ size: 'sm' })}>
              Open stores
            </Link>
          </CardContent>
        </Card>
      ) : (
        <StoreTicketForm
          stores={stores}
          items={items}
          stock={shelf.byItem}
          today={today(ctx.organization.timeZone)}
          documentNumber={documentNumber}
          initialStoreId={initialStoreId}
          initialItemId={initialItemId}
        />
      )}
    </>
  )
}

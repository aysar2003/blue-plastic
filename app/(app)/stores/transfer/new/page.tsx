import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { StoreTransferForm } from '@/components/inventory/store-transfer-form'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import * as inventoryService from '@/server/services/inventory.service'
import * as storeService from '@/server/services/store.service'

export const metadata: Metadata = { title: 'Transfer to store' }

export default async function NewStoreTransferPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('inventory:adjust')
  const query = await searchParams
  const fromParam = typeof query.from === 'string' ? query.from : undefined
  const itemParam = typeof query.item === 'string' ? query.item : undefined

  const [stores, stock, documentNumber] = await Promise.all([
    storeService.columns(ctx),
    inventoryService.stockOnHand(ctx),
    peekDocumentNumber(db, ctx.orgId, 'STORE_TRANSFER'),
  ])

  const initialFromStoreId = stores.some((store) => store.id === fromParam) ? fromParam : stores[0]?.id
  const items = stock.items.map((item) => ({
    id: item.itemId,
    label: item.name,
    onHand: item.quantity.toFixed(2),
  }))
  const initialItemId = items.some((item) => item.id === itemParam) ? itemParam : undefined

  return (
    <>
      <PageHeader
        title="Transfer to store"
        description="Move stock from one store to another. Quantity and cost leave with the item — the books stay in balance."
        actions={
          initialFromStoreId ? (
            <Link href={`/stores/${initialFromStoreId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Back to store
            </Link>
          ) : null
        }
      />
      {stores.length < 2 ? (
        <Card tone="warning">
          <CardContent className="space-y-3 p-4 text-sm">
            <p>You need at least two stores before stock can be transferred.</p>
            <Link href="/stores" className={buttonVariants({ size: 'sm' })}>
              Open stores
            </Link>
          </CardContent>
        </Card>
      ) : (
        <StoreTransferForm
          stores={stores}
          items={items}
          today={today(ctx.organization.timeZone)}
          documentNumber={documentNumber}
          initialFromStoreId={initialFromStoreId}
          initialItemId={initialItemId}
        />
      )}
    </>
  )
}

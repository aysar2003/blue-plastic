import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { StoreForm } from '@/components/inventory/store-form'
import { Card, CardContent } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import * as storeService from '@/server/services/store.service'

export const metadata: Metadata = { title: 'Store' }

export default async function StoresPage() {
  const ctx = await requireOrgContext('inventory:read')
  const stores = await storeService.overview(ctx)
  const canCreate = ctx.permissions.has('account:create')

  return (
    <>
      <PageHeader
        title="Store"
        description="Each store keeps its own quantity. On hand is the sum of the stores. A bill or an opening balance names the store that receives the item. A sale leaves the office unless you choose another store. A store may go below zero, and a later bill fills it."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stores.map((store) => (
          <Link key={store.id} href={`/stores/${store.id}`} className="block">
            <Card className="h-full transition-colors hover:bg-slate-50">
              <CardContent className="grid gap-3 p-4">
                <div>
                  <p className="font-medium">
                    {store.name}
                    {store.isOffice ? <span className="ml-2 text-xs text-muted-foreground">Office</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {store.code} {store.accountName}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">In stock</dt>
                    <dd className="tabular font-medium text-[#0F766E]">{store.inStock}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Zero</dt>
                    <dd className="tabular font-medium">{store.zero}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Below zero</dt>
                    <dd className="tabular font-medium text-[#C2410C]">{store.negative}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {canCreate ? (
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm text-muted-foreground">
              A new store gets its own inventory account, listed beside Inventory Asset, and its own dashboard.
            </p>
            <StoreForm />
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}

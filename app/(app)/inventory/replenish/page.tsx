import type { Metadata } from 'next'
import Link from 'next/link'

import { draftReplenishAction, postDraftReplenishAction } from '@/app/(app)/inventory/replenish/actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as inventory from '@/server/services/inventory.service'

export const metadata: Metadata = { title: 'Store replenishment' }

export default async function ReplenishPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; posted?: string }>
}) {
  const ctx = await requireOrgContext('inventory:read')
  const query = await searchParams
  const stores = await db.store.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { id: true, name: true, isOffice: true },
    orderBy: [{ isOffice: 'desc' }, { name: 'asc' }],
  })
  const toStoreId =
    query.storeId ?? stores.find((row) => !row.isOffice)?.id ?? stores[0]?.id ?? ''
  const [plan, draftTransfers] = toStoreId
    ? await Promise.all([
        inventory.replenishmentSuggestions(ctx, toStoreId),
        inventory.listDraftReplenishmentTransfers(ctx, toStoreId),
      ])
    : [null, []]
  const canDraft = ctx.permissions.has('inventory:adjust')
  const postedBanner = query.posted === '1'

  return (
    <>
      <PageHeader
        title="Replenishment"
        description="Items at or below reorder for a store, with suggested transfer qty from the office or default DC."
        actions={
          <Link href="/inventory/stock" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Stock on hand
          </Link>
        }
      />

      {postedBanner ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Draft replenishment transfers were posted to stock.
        </p>
      ) : null}

      {draftTransfers.length > 0 ? (
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">
              <span className="font-medium">{draftTransfers.length}</span> draft transfer
              {draftTransfers.length === 1 ? '' : 's'} waiting to post for this store.
            </p>
            {canDraft ? (
              <form action={postDraftReplenishAction}>
                <input type="hidden" name="toStoreId" value={toStoreId} />
                <button type="submit" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Post draft transfers
                </button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <form className="flex flex-wrap items-end gap-2" method="get">
            <label className="text-xs">
              Store to replenish
              <NativeSelect name="storeId" defaultValue={toStoreId} className="mt-1">
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                    {store.isOffice ? ' (office)' : ''}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
              Refresh
            </button>
          </form>
          {plan?.fromStore ? (
            <p className="text-sm text-muted-foreground">
              Draft transfers from <span className="font-medium">{plan.fromStore.name}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {!plan || plan.suggestions.length === 0 ? (
        <EmptyState
          title="Nothing to replenish"
          description="Set reorder points on products and pick a branch store that is below limit."
        />
      ) : (
        <form action={draftReplenishAction}>
          <input type="hidden" name="toStoreId" value={toStoreId} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                <TableHead className="text-right">Source on hand</TableHead>
                <TableHead className="text-right">Suggest qty</TableHead>
                <TableHead className="w-24">Include</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.suggestions.map((row) => (
                <TableRow key={row.itemId}>
                  <TableCell className="font-medium">
                    {row.name}
                    {row.sku ? ` · ${row.sku}` : ''}
                  </TableCell>
                  <TableCell className="text-right tabular">{row.onHand}</TableCell>
                  <TableCell className="text-right tabular">{row.reorderPoint}</TableCell>
                  <TableCell className="text-right tabular">{row.sourceOnHand}</TableCell>
                  <TableCell className="text-right tabular">{row.suggestedQty}</TableCell>
                  <TableCell>
                    <input type="checkbox" name={`line_${row.itemId}`} defaultChecked />
                    <input type="hidden" name={`qty_${row.itemId}`} value={row.suggestedQty} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {canDraft ? (
            <div className="mt-4">
              <button type="submit" className={buttonVariants()}>
                Create draft transfers
              </button>
            </div>
          ) : null}
        </form>
      )}
    </>
  )
}
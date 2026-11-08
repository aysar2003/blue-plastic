import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as itemLotService from '@/server/services/item-lot.service'

export const metadata: Metadata = { title: 'Lot expiry' }

export default async function InventoryExpiryPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const ctx = await requireOrgContext('inventory:read')
  const query = await searchParams
  const withinDays = Math.min(Math.max(Number(query.days) || 90, 1), 730)
  const [lots, controlled] = await Promise.all([
    itemLotService.listExpiringLots(ctx, { withinDays }),
    itemLotService.listControlledItems(ctx),
  ])

  return (
    <>
      <PageHeader
        title="Lot expiry"
        description="Batches nearing or past expiry, plus pharmacy-controlled products."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/inventory/lots" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Stock by lot
            </Link>
            <Link href="/items" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Products
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[30, 60, 90, 180].map((days) => (
          <Link
            key={days}
            href={`/inventory/expiry?days=${days}`}
            className={buttonVariants({
              variant: withinDays === days ? 'default' : 'outline',
              size: 'sm',
            })}
          >
            {days} days
          </Link>
        ))}
      </div>

      {lots.length === 0 ? (
        <EmptyState
          title="No lots in this window"
          description="Receive stock with a lot number and expiry date, then return here to watch the shelf life."
        />
      ) : (
        <Card className="mb-6">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell>
                      <Link href={`/inventory/${lot.itemId}`} className="font-medium hover:underline">
                        {lot.itemName}
                      </Link>
                      {lot.sku ? (
                        <span className="ml-2 text-xs text-muted-foreground">{lot.sku}</span>
                      ) : null}
                      {lot.pharmacyControlled ? (
                        <Badge variant="secondary" className="ml-2">
                          Controlled
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium tabular">{lot.lotNumber}</TableCell>
                    <TableCell className="tabular">{lot.expiryDate ?? '—'}</TableCell>
                    <TableCell className="text-right tabular">{lot.daysUntilExpiry ?? '—'}</TableCell>
                    <TableCell>
                      {lot.expired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (lot.daysUntilExpiry ?? 999) <= 30 ? (
                        <Badge variant="secondary">Soon</Badge>
                      ) : (
                        <span className="text-muted-foreground">OK</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <PageHeader
        title="Controlled items"
        description="Products marked pharmacy-controlled — dispense requires a registered lot."
        className="mb-2 mt-8"
      />
      {controlled.length === 0 ? (
        <EmptyState
          title="No controlled products"
          description="Turn on Pharmacy controlled on an inventory product when the item needs lot-gated dispense."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Lots</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {controlled.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link href={`/inventory/${item.id}`} className="font-medium hover:underline">
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.sku ?? '—'}</TableCell>
                    <TableCell>{item.trackLots ? 'Tracked' : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  )
}

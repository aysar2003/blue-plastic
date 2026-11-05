import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatQty } from '@/lib/quantity'
import { requireOrgContext } from '@/server/auth/context'
import * as inventoryService from '@/server/services/inventory.service'

export const metadata: Metadata = { title: 'Stock by lot' }

export default async function InventoryLotsPage() {
  const ctx = await requireOrgContext('inventory:read')
  const { items } = await inventoryService.stockByLot(ctx)

  return (
    <>
      <PageHeader
        title="Stock by lot"
        description="On-hand quantities for products that track lots or serial numbers. Receive and issue must name the lot or serial."
        actions={
          <Link href="/inventory/stock" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Stock on hand
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No lot- or serial-tracked products"
          description="Turn on Track lots or Track serials on an inventory product, then receive stock with a lot or serial."
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/inventory/${item.id}`} className="font-medium hover:underline">
                    {item.name}
                  </Link>
                  {item.sku ? (
                    <span className="text-xs text-muted-foreground">{item.sku}</span>
                  ) : null}
                  {item.trackLots ? <Badge variant="secondary">Lots</Badge> : null}
                  {item.trackSerials ? <Badge variant="secondary">Serials</Badge> : null}
                </div>

                {item.slices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing on hand yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{item.trackSerials ? 'Serial' : 'Lot'}</TableHead>
                        <TableHead className="w-36 text-right">On hand</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {item.slices.map((slice) => (
                        <TableRow
                          key={`${slice.kind}-${slice.lotNumber ?? ''}-${slice.serialNumber ?? ''}`}
                        >
                          <TableCell className="font-medium tabular">
                            {slice.serialNumber ?? slice.lotNumber ?? '— unlotted —'}
                          </TableCell>
                          <TableCell className="tabular text-right">
                            {formatQty(slice.quantity.toString(), item.unitOfMeasure)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

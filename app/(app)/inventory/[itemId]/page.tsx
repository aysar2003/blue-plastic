import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MetricCard } from '@/components/data/metric-card'
import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, toCalendarDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as inventoryService from '@/server/services/inventory.service'

export const metadata: Metadata = { title: 'Stock movements' }

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Received',
  SALE: 'Sold',
  SALE_RETURN: 'Returned by customer',
  PURCHASE_RETURN: 'Returned to vendor',
  ADJUSTMENT: 'Adjustment',
  OPENING: 'Opening stock',
  TRANSFER: 'Store transfer',
}

/**
 * One item's stock ledger. The running quantity and value on every row are the
 * item's actual position after that movement — not recomputed for display, but
 * the figures the ledger was written with.
 */
export default async function ItemMovementsPage({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const ctx = await requireOrgContext('inventory:read')
  const { itemId } = await params

  const item = await db.item.findFirst({
    where: { id: itemId, orgId: ctx.orgId, type: 'INVENTORY' },
    select: { id: true, name: true, sku: true, reorderPoint: true },
  })
  if (!item) notFound()

  const canEdit = ctx.permissions.has('item:update')
  const canAdjust = ctx.permissions.has('inventory:adjust')
  const movements = await inventoryService.movementsFor(ctx, itemId)
  const currency = ctx.organization.baseCurrency
  const latest = movements.at(-1)

  return (
    <>

      <PageHeader title={item.name} description={item.sku ?? undefined} />

      <div className="mb-4 flex flex-wrap gap-2">
        {canEdit ? (
          <Link href={`/items?edit=${item.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Edit
          </Link>
        ) : null}
        <Link href={`/items/${item.id}/report`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Quick report
        </Link>
        {canAdjust ? (
          <Link
            href={`/inventory/adjustments/new?item=${item.id}`}
            className={buttonVariants({ size: 'sm' })}
          >
            Adjustment
          </Link>
        ) : null}
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="On hand"
          tone="stock"
          value={latest ? latest.runningQuantity.toFixed(2) : '0.00'}
        />
        <MetricCard
          label="Average cost"
          tone="info"
          value={
            latest && !latest.runningQuantity.isZero()
              ? formatMoney(latest.runningValue.dividedBy(latest.runningQuantity), currency)
              : '—'
          }
        />
        <MetricCard
          label="Total cost"
          tone="money"
          value={formatMoney(latest?.runningValue ?? 0, currency)}
        />
      </div>

      {movements.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nothing has moved yet. Receive some on a bill, and it will appear here.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>What happened</TableHead>
                <TableHead className="numeric w-24">Quantity</TableHead>
                <TableHead className="numeric w-28">Unit cost</TableHead>
                <TableHead className="numeric w-28">Value</TableHead>
                <TableHead className="numeric w-24">On hand</TableHead>
                <TableHead className="numeric w-28">Held at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="tabular text-muted-foreground">{movement.sequence}</TableCell>
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                    {formatDate(toCalendarDate(movement.date))}
                  </TableCell>
                  <TableCell>
                    <span className="block">{TYPE_LABELS[movement.type] ?? movement.type}</span>
                    {movement.journal ? (
                      <Link
                        href={`/journals/${movement.journal.id}`}
                        className="tabular block text-xs text-muted-foreground underline-offset-4 hover:underline"
                      >
                        {movement.journal.journalNumber}
                      </Link>
                    ) : (
                      <Badge variant="destructive" className="mt-1">
                        no entry
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="numeric tabular">
                    {movement.quantity.isPositive() ? '+' : ''}
                    {movement.quantity.toFixed(2)}
                  </TableCell>
                  <TableCell className="numeric tabular text-muted-foreground">
                    {formatMoney(movement.unitCost, currency)}
                  </TableCell>
                  <TableCell className="numeric tabular">
                    {formatMoney(movement.value, currency)}
                  </TableCell>
                  <TableCell className="numeric tabular font-medium">
                    {movement.runningQuantity.toFixed(2)}
                  </TableCell>
                  <TableCell className="numeric tabular font-medium">
                    {formatMoney(movement.runningValue, currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            {latest ? (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6} className="font-semibold">
                    On hand · average cost · total cost
                  </TableCell>
                  <TableCell className="numeric tabular font-semibold">
                    {latest.runningQuantity.toFixed(2)}
                  </TableCell>
                  <TableCell className="numeric tabular font-semibold">
                    {formatMoney(latest.runningValue, currency)}
                    {!latest.runningQuantity.isZero() ? (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        avg{' '}
                        {formatMoney(
                          latest.runningValue.dividedBy(latest.runningQuantity),
                          currency,
                        )}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </Card>
      )}
    </>
  )
}

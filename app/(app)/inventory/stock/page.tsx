import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangleIcon, CheckCircle2Icon, PackageIcon, ScaleIcon } from 'lucide-react'

import { ClickableRow } from '@/components/data/clickable-row'
import { EmptyState } from '@/components/data/empty-state'
import { MetricCard } from '@/components/data/metric-card'
import { PageHeader } from '@/components/data/page-header'
import { readSort, SortableHeader } from '@/components/data/sortable-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DeleteButton } from '@/components/data/delete-record'
import { ItemNameMenu } from '@/components/inventory/item-name-menu'
import { ReorderLimitField } from '@/components/inventory/reorder-limit'
import { formatTransactionDate, toCalendarDate } from '@/lib/date'
import { formatMoney, ZERO } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as inventoryService from '@/server/services/inventory.service'

export const metadata: Metadata = { title: 'Stock on hand' }

const SORTABLE = ['name', 'quantity', 'price', 'cost', 'value'] as const

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const sort = readSort(params, SORTABLE, { sort: 'name', dir: 'asc' })
  const alertParam = typeof params.alert === 'string' ? params.alert : 'all'
  const alert = alertParam === 'out' || alertParam === 'limit' ? alertParam : 'all'
  const ctx = await requireOrgContext('inventory:read')

  const [stock, agreement, adjustments] = await Promise.all([
    inventoryService.stockOnHand(ctx),
    inventoryService.agreement(ctx),
    inventoryService.listAdjustments(ctx),
  ])

  const currency = ctx.organization.baseCurrency
  const canAdjust = ctx.permissions.has('inventory:adjust')
  const canEdit = ctx.permissions.has('item:update')
  const outOfStock = stock.items.filter((item) => item.quantity.lessThanOrEqualTo(0))
  const atLimit = stock.items.filter((item) => item.quantity.greaterThan(0) && item.belowReorder)
  const sortParams = alert === 'all' ? undefined : { alert }

  // Sorted here rather than in the query: quantity, average cost and value are
  // computed from the stock ledger, so there is no column to order by.
  const direction = sort.dir === 'asc' ? 1 : -1
  const items = [...stock.items].sort((a, b) => {
    switch (sort.sort) {
      case 'quantity':
        return direction * a.quantity.comparedTo(b.quantity)
      case 'price':
        return direction * (a.salesPrice ?? ZERO).comparedTo(b.salesPrice ?? ZERO)
      case 'cost':
        return direction * a.averageCost.comparedTo(b.averageCost)
      case 'value':
        return direction * a.value.comparedTo(b.value)
      default:
        return direction * a.name.localeCompare(b.name)
    }
  }).filter((item) => {
    if (alert === 'out') return item.quantity.lessThanOrEqualTo(0)
    if (alert === 'limit') return item.quantity.greaterThan(0) && item.belowReorder
    return true
  })

  return (
    <>
      <PageHeader
        title="Stock on hand"
        description="The valuation view of the tracked products. Same records as Products &amp; services — this is what they are worth, at weighted-average cost, and whether the stock ledger agrees with the Inventory Asset account."
        actions={
          canAdjust ? (
            <Link href="/inventory/adjustments/new" className={buttonVariants({ size: 'sm' })}>
              <ScaleIcon /> Adjust stock
            </Link>
          ) : undefined
        }
      />

      {stock.items.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title="No tracked items yet"
          description="Create a product with the Inventory type. The dialog asks for its stock accounts, its reorder point and what is on the shelf today, so it lands here already counted."
          action={
            <Link href="/items" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Products and services
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Stock value"
              tone="money"
              value={formatMoney(stock.totalValue, currency)}
            />
            <MetricCard label="Tracked items" tone="stock" value={stock.items.length} />
            <MetricCard
              label="Out of stock"
              tone="danger"
              value={outOfStock.length === 0 ? '—' : outOfStock.length}
            />
            <MetricCard
              label="At the reorder limit"
              tone="warning"
              value={atLimit.length === 0 ? '—' : atLimit.length}
            />
          </div>

          {stock.items.every((item) => item.quantity.isZero()) ? (
            <Card className="mb-4">
              <CardContent className="flex items-start gap-2.5 p-4 text-sm">
                <PackageIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Nothing has been received yet.</strong> Stock only
                  exists where the ledger says it does, so it arrives one of three ways: the{' '}
                  <Link href="/items" className="underline underline-offset-4">
                    opening quantity
                  </Link>{' '}
                  entered when the product was created,{' '}
                  <Link href="/purchases/bills/new" className="underline underline-offset-4">
                    the bill
                  </Link>{' '}
                  you bought it on, or{' '}
                  <Link href="/inventory/adjustments/new" className="underline underline-offset-4">
                    a count recorded as an adjustment
                  </Link>
                  .
                </span>
              </CardContent>
            </Card>
          ) : null}

          {outOfStock.length > 0 || atLimit.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-[#fff1f2] px-4 py-3 text-sm ring-1 ring-[#fecdd3]">
              <AlertTriangleIcon className="size-4 shrink-0 text-[#9f1239]" />
              <p className="min-w-0 flex-1">
                {outOfStock.length > 0 ? (
                  <span className="font-medium text-[#9f1239]">{outOfStock.length} out of stock. </span>
                ) : null}
                {atLimit.length > 0 ? (
                  <span className="font-medium text-[#C2410C]">
                    {atLimit.length} reached the reorder limit and can be ordered.
                  </span>
                ) : null}
              </p>
              <Link href="/purchases/purchase-orders/new" className={buttonVariants({ size: 'sm' })}>
                Order
              </Link>
            </div>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Stock warnings">
            {(
              [
                ['all', 'All', stock.items.length],
                ['out', 'Out of stock', outOfStock.length],
                ['limit', 'Reorder limit', atLimit.length],
              ] as const
            ).map(([id, label, count]) => (
              <Link
                key={id}
                href={id === 'all' ? '/inventory/stock' : `/inventory/stock?alert=${id}`}
                aria-current={alert === id ? 'true' : undefined}
                className={`rounded-md px-2.5 py-1 text-sm ${
                  alert === id ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
                <span className="tabular ml-1.5 text-xs">{count}</span>
              </Link>
            ))}
          </div>

          <Card className="mb-6 overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader column="name" label="Item" state={sort} basePath="/inventory/stock" params={sortParams} />
                  <SortableHeader column="quantity" label="On hand" state={sort} basePath="/inventory/stock" params={sortParams} className="w-36" numeric defaultDirection="desc" />
                  <TableHead className="numeric w-32">Reorder limit</TableHead>
                  <SortableHeader column="price" label="Sales price" state={sort} basePath="/inventory/stock" params={sortParams} className="w-32" numeric defaultDirection="desc" />
                  <SortableHeader column="cost" label="Average cost" state={sort} basePath="/inventory/stock" params={sortParams} className="w-32" numeric defaultDirection="desc" />
                  <SortableHeader column="value" label="Value" state={sort} basePath="/inventory/stock" params={sortParams} className="w-32" numeric defaultDirection="desc" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      {alert === 'out'
                        ? 'Nothing is out of stock.'
                        : 'Nothing has reached its reorder limit.'}
                    </TableCell>
                  </TableRow>
                ) : null}
                {items.map((item) => (
                  <ClickableRow
                    key={item.itemId}
                    href={`/items/${item.itemId}/report`}
                    title={`Open report for ${item.name}`}
                  >
                    <TableCell>
                      <ItemNameMenu
                        id={item.itemId}
                        name={item.name}
                        tracked
                        canEdit={canEdit}
                        canAdjust={canAdjust}
                      />
                      {item.sku ? (
                        <span className="block text-xs text-muted-foreground">{item.sku}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="numeric tabular">
                      {item.quantity.toFixed(2)}
                      {item.quantity.lessThanOrEqualTo(0) ? (
                        <Badge variant="destructive" className="ml-2">
                          Out of stock
                        </Badge>
                      ) : item.belowReorder ? (
                        <Badge variant="warning" className="ml-2">
                          At limit
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="numeric">
                      <span className="inline-flex items-center justify-end gap-2">
                        {canEdit ? (
                          <ReorderLimitField
                            itemId={item.itemId}
                            initial={item.reorderPoint ? item.reorderPoint.toFixed(2) : ''}
                          />
                        ) : (
                          <span className="tabular text-muted-foreground">
                            {item.reorderPoint ? item.reorderPoint.toFixed(2) : '—'}
                          </span>
                        )}
                        {item.quantity.lessThanOrEqualTo(0) || item.belowReorder ? (
                          <Link href="/purchases/purchase-orders/new" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
                            Order
                          </Link>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="numeric tabular text-muted-foreground">
                      {item.salesPrice ? formatMoney(item.salesPrice, currency) : '—'}
                    </TableCell>
                    <TableCell className="numeric tabular text-muted-foreground">
                      {item.averageCost.isZero() ? '—' : formatMoney(item.averageCost, currency)}
                    </TableCell>
                    <TableCell className="numeric tabular font-medium">
                      {formatMoney(item.value, currency)}
                    </TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="font-semibold">
                    Total
                  </TableCell>
                  <TableCell className="numeric tabular font-semibold">
                    {formatMoney(
                      items.reduce((sum, item) => sum.plus(item.value), ZERO),
                      currency,
                    )}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>

            <div
              className={`flex items-start gap-2 border-t px-3 py-2.5 text-sm ${
                agreement.agrees ? 'text-success' : 'text-destructive'
              }`}
            >
              {agreement.agrees ? (
                <>
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Agrees with the Inventory Asset account at{' '}
                    <span className="tabular">{formatMoney(agreement.ledgerBalance, currency)}</span>.
                    Every movement posts its own value to the ledger, in the same transaction.
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Stock is worth{' '}
                    <strong className="tabular">{formatMoney(agreement.stockValue, currency)}</strong> but
                    the Inventory Asset account holds{' '}
                    <strong className="tabular">{formatMoney(agreement.ledgerBalance, currency)}</strong>.
                    One of them is wrong about what the business owns — investigate before relying on
                    either.
                  </span>
                </>
              )}
            </div>
          </Card>
        </>
      )}

      <h2 id="adjustments" className="mb-3 scroll-mt-20 text-sm font-semibold">Adjustments</h2>

      {adjustments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No adjustments yet. A stock count that disagrees with the books is recorded here, and the
            difference goes to Inventory Shrinkage rather than being buried in cost of goods sold.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Number</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="numeric w-20">Items</TableHead>
                <TableHead className="numeric w-32">Value change</TableHead>
                <TableHead className="w-28">Entry</TableHead>
                <TableHead className="w-24 print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.map((adjustment) => (
                <TableRow key={adjustment.id}>
                  <TableCell className="tabular font-medium">
                    {adjustment.number}
                    {adjustment.status === 'VOID' ? (
                      <Badge variant="destructive" className="ml-2">
                        void
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                    {formatTransactionDate(toCalendarDate(adjustment.date), adjustment.createdAt, ctx.organization.timeZone)}
                  </TableCell>
                  <TableCell>{adjustment.reason ?? adjustment.memo ?? '—'}</TableCell>
                  <TableCell className="numeric tabular">{adjustment.lineCount}</TableCell>
                  <TableCell className="numeric tabular">
                    {formatMoney(adjustment.totalValue, currency)}
                  </TableCell>
                  <TableCell>
                    {adjustment.journal ? (
                      <Link
                        href={`/journals/${adjustment.journal.id}`}
                        className="tabular text-sm underline-offset-4 hover:underline"
                      >
                        {adjustment.journal.journalNumber}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="print:hidden">
                    {canAdjust && ctx.features.allowDocumentDelete ? (
                      <DeleteButton
                        kind="inventory-adjustment"
                        id={adjustment.id}
                        number={adjustment.number}
                        variant="ghost"
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  )
}

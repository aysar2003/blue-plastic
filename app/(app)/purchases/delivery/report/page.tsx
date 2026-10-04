import type { Metadata } from 'next'
import Link from 'next/link'
import { PackageIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { FilterChips } from '@/components/data/filter-chips'
import { PageHeader } from '@/components/data/page-header'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { DeliveryBucketBadge } from '@/components/purchases/delivery-order-table'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import { formatMoney, ZERO } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as delivery from '@/server/services/delivery.service'

export const metadata: Metadata = { title: 'Delivery report' }

const FILTERS = [
  { value: '', label: 'All orders' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'delivered', label: 'Delivered' },
]

/**
 * Line-by-line delivery against every purchase order: ordered, received, and
 * what is still due — so a purchase is never half-explained.
 */
export default async function DeliveryReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('bill:read')
  const search = await searchParams
  const filterRaw = typeof search.filter === 'string' ? search.filter : ''
  const filter =
    filterRaw === 'outstanding' || filterRaw === 'delivered' ? filterRaw : 'all'
  const vendorId = typeof search.vendorId === 'string' ? search.vendorId : undefined

  const orders = await delivery.detailReport(ctx, {
    filter,
    vendorId,
  })
  const currency = ctx.organization.baseCurrency

  const totals = orders.reduce(
    (acc, order) => ({
      ordered: acc.ordered.plus(order.orderedValue),
      received: acc.received.plus(order.receivedValue),
      outstanding: acc.outstanding.plus(order.outstandingValue),
    }),
    { ordered: ZERO, received: ZERO, outstanding: ZERO },
  )

  return (
    <>
      <PageHeader
        title="Delivery report"
        description="Every purchase order with what was ordered, what arrived, and what is still outstanding — line by line."
        actions={
          <Link href="/purchases/delivery" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Delivery home
          </Link>
        }
      />

      <div className="mb-3">
        <FilterChips
          options={FILTERS}
          active={filter === 'all' ? '' : filter}
          path="/purchases/delivery/report"
          param="filter"
          params={{ vendorId }}
        />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <TotalCard label="Ordered value" value={formatMoney(totals.ordered, currency)} />
        <TotalCard label="Received value" value={formatMoney(totals.received, currency)} />
        <TotalCard label="Outstanding value" value={formatMoney(totals.outstanding, currency)} />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title="No purchase orders in this filter"
          description="Place an order, then receive against it. Both sides of that story appear here."
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={order.href}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {order.number}
                    </Link>
                    <DeliveryBucketBadge bucket={order.bucket} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {order.vendorName} · {formatDate(order.date)}
                    {order.receiptCount > 0
                      ? ` · ${order.receiptCount} ${order.receiptCount === 1 ? 'receipt' : 'receipts'}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="tabular text-muted-foreground">
                    Received {order.receivedQty} / {order.orderedQty}
                  </span>
                  <span className="tabular font-medium">
                    Still due {formatMoney(order.outstandingValue, currency)}
                  </span>
                  {order.bucket !== 'delivered' ? (
                    <Link
                      href={order.receiveHref}
                      className={buttonVariants({ size: 'sm' })}
                    >
                      Receive
                    </Link>
                  ) : null}
                </div>
              </div>

              <ScrollSheet>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="numeric w-24">Ordered</TableHead>
                      <TableHead className="numeric w-24">Received</TableHead>
                      <TableHead className="numeric w-28">Outstanding</TableHead>
                      <TableHead className="numeric w-28">Unit cost</TableHead>
                      <TableHead className="numeric w-32">Outstanding value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.lines.map((line) => (
                      <TableRow key={line.lineId}>
                        <TableCell>
                          <p className="font-medium">{line.itemName}</p>
                          {line.description && line.description !== line.itemName ? (
                            <p className="text-xs text-muted-foreground">{line.description}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="numeric tabular">{line.ordered}</TableCell>
                        <TableCell className="numeric tabular">{line.received}</TableCell>
                        <TableCell className="numeric tabular font-medium">
                          {line.outstanding}
                        </TableCell>
                        <TableCell className="numeric tabular text-muted-foreground">
                          {formatMoney(line.unitPrice, currency)}
                        </TableCell>
                        <TableCell className="numeric tabular">
                          {Number(line.outstanding) === 0
                            ? '—'
                            : formatMoney(line.outstandingValue, currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollSheet>

              {order.receipts.length > 0 ? (
                <CardContent className="border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
                  Received on{' '}
                  {order.receipts.map((receipt, index) => (
                    <span key={receipt.id}>
                      {index > 0 ? ', ' : ''}
                      <Link
                        href={`/purchases/bills/${receipt.id}`}
                        className="font-medium underline underline-offset-4"
                      >
                        {receipt.number}
                      </Link>{' '}
                      ({formatDate(receipt.date)})
                    </span>
                  ))}
                  .
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

function TotalCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="tabular mt-0.5 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

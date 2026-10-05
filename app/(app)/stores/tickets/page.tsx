import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MetricCard } from '@/components/data/metric-card'
import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatDateTime, toCalendarDate } from '@/lib/date'
import { Decimal } from '@/lib/money'
import { cn } from '@/lib/utils'
import { requireOrgContext } from '@/server/auth/context'
import * as inventoryService from '@/server/services/inventory.service'
import type { StoreTicketFilter } from '@/server/services/inventory.service'
import { db } from '@/server/db'

export const metadata: Metadata = { title: 'Store tickets' }

const FILTERS: { value: StoreTicketFilter; label: string }[] = [
  { value: 'all', label: 'Issued' },
  { value: 'pending', label: 'To prepare' },
  { value: 'prepared', label: 'Prepared' },
  { value: 'void', label: 'Cancelled' },
]

function readFilter(value: string | string[] | undefined): StoreTicketFilter {
  if (value === 'pending' || value === 'prepared' || value === 'void') return value
  return 'all'
}

export default async function StoreTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('inventory:read')
  const search = await searchParams
  const storeId = typeof search.store === 'string' ? search.store : undefined
  const filter = readFilter(search.filter)

  if (storeId) {
    const store = await db.store.findFirst({
      where: { id: storeId, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!store) notFound()
  }

  const [summary, tickets] = await Promise.all([
    inventoryService.storeTicketSummary(ctx, storeId),
    inventoryService.storeTicketList(ctx, { storeId, filter, limit: 150 }),
  ])

  const hrefFor = (next: { filter?: StoreTicketFilter; store?: string }) => {
    const params = new URLSearchParams()
    if (next.store ?? storeId) params.set('store', next.store ?? storeId!)
    if ((next.filter ?? filter) !== 'all') params.set('filter', next.filter ?? filter)
    const q = params.toString()
    return q ? `/stores/tickets?${q}` : '/stores/tickets'
  }

  return (
    <>
      <PageHeader
        title="Store tickets"
        description="Issue register — every pick ticket from sales, transfers, and manual issues. Prepared means goods handed to the customer."
        actions={
          <Link href={storeId ? `/stores/${storeId}` : '/stores'} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Back to store
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Issued (active)" value={summary.active} tone="info" href={hrefFor({ filter: 'all' })} />
        <MetricCard label="To prepare" value={summary.pending} tone="warning" href={hrefFor({ filter: 'pending' })} />
        <MetricCard label="Prepared" value={summary.prepared} tone="stock" href={hrefFor({ filter: 'prepared' })} />
        <MetricCard label="Cancelled" value={summary.voided} tone="danger" href={hrefFor({ filter: 'void' })} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {FILTERS.map((item) => (
          <Link
            key={item.value}
            href={hrefFor({ filter: item.value })}
            className={cn(
              'rounded-md px-2.5 py-1 text-sm',
              filter === item.value ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Ticket</TableHead>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Sale / customer</TableHead>
              <TableHead className="numeric w-20">Qty</TableHead>
              <TableHead className="w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No tickets in this view.
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => {
                const saleHref = ticket.salesDocument
                  ? ticket.salesDocument.type === 'SALES_RECEIPT'
                    ? `/sales/sales-receipts/${ticket.salesDocument.id}`
                    : `/sales/invoices/${ticket.salesDocument.id}`
                  : null
                return (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium tabular">
                      <Link
                        href={`/stores/tickets/${ticket.id}/print`}
                        className="underline-offset-4 hover:underline"
                      >
                        {ticket.number}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      <div>{formatDate(toCalendarDate(ticket.date))}</div>
                      <div className="text-xs">
                        {formatDateTime(ticket.createdAt, ctx.organization.timeZone)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/items/${ticket.item.id}/report`}
                        className="underline-offset-4 hover:underline"
                      >
                        {ticket.item.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/stores/${ticket.store.id}`} className="underline-offset-4 hover:underline">
                        {ticket.store.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {ticket.salesDocument && saleHref ? (
                        <Link href={saleHref} className="tabular underline-offset-4 hover:underline">
                          {ticket.salesDocument.number}
                        </Link>
                      ) : null}
                      {ticket.takenBy ? (
                        <span className="block text-xs text-muted-foreground">{ticket.takenBy}</span>
                      ) : null}
                      {ticket.deliveryNote ? (
                        <Link
                          href={`/sales/delivery/${ticket.deliveryNote.id}/print`}
                          className="block text-xs text-primary underline-offset-4 hover:underline"
                        >
                          DN {ticket.deliveryNote.number}
                        </Link>
                      ) : null}
                    </TableCell>
                    <TableCell className="numeric tabular">
                      {new Decimal(ticket.quantity.toString()).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {ticket.status === 'VOID' ? (
                        <Badge variant="destructive">Cancelled</Badge>
                      ) : ticket.preparedAt ? (
                        <Badge variant="success">Prepared</Badge>
                      ) : ticket.origin === 'SALE' ? (
                        <Badge variant="warning">To prepare</Badge>
                      ) : (
                        <Badge variant="secondary">Issued</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

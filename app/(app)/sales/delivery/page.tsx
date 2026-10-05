import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { PackageCheckIcon, PackageIcon, TruckIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { ClickableRow } from '@/components/data/clickable-row'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatDateTime } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as salesDelivery from '@/server/services/sales-delivery.service'

export const metadata: Metadata = { title: 'Sales delivery' }

/**
 * Dispatch dashboard for customer delivery notes.
 *
 * Purchase "Delivery" books goods in against orders. This hub is the outbound
 * side: every invoice or sales receipt that ships stock raises a DN- note and
 * store tickets automatically.
 */
export default async function SalesDeliveryHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const search = await searchParams
  const customerId = typeof search.customerId === 'string' ? search.customerId : undefined
  const showVoid = search.status === 'void'

  const [summary, rows] = await Promise.all([
    salesDelivery.overview(ctx),
    salesDelivery.list(ctx, {
      customerId,
      status: showVoid ? 'VOID' : 'POSTED',
    }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales delivery"
        description="Delivery notes for goods leaving the store. Raised automatically when an invoice or sales receipt posts — print for the carrier, open from the customer, or look up by DN number."
        actions={
          <Link href="/sales/invoices/new" className={buttonVariants({ size: 'sm' })}>
            New invoice
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Insight
          label="Open notes"
          value={String(summary.posted)}
          hint="ready to print or hand over"
          icon={<PackageCheckIcon className="size-4" />}
          tone="stock"
        />
        <Insight
          label="Issued today"
          value={String(summary.today)}
          hint="same calendar day"
          icon={<TruckIcon className="size-4" />}
          tone="info"
        />
        <Insight
          label="Recent"
          value={String(summary.recent.length)}
          hint="latest on the list"
          icon={<PackageIcon className="size-4" />}
          tone="ledger"
        />
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={customerId ? `/sales/delivery?customerId=${customerId}` : '/sales/delivery'}
          className={!showVoid ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}
        >
          Active
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link
          href={
            customerId
              ? `/sales/delivery?customerId=${customerId}&status=void`
              : '/sales/delivery?status=void'
          }
          className={showVoid ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}
        >
          Voided
        </Link>
        {customerId ? (
          <>
            <span className="text-muted-foreground">·</span>
            <Link href="/sales/delivery" className="text-muted-foreground hover:text-foreground">
              Clear customer filter
            </Link>
          </>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={TruckIcon}
          title={showVoid ? 'No voided delivery notes' : 'No delivery notes yet'}
          description={
            showVoid
              ? 'Voided notes appear here when a sale that had shipped goods is withdrawn.'
              : 'Post an invoice or sales receipt with products — a delivery note (DN-) and store tickets are created automatically for the load.'
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <ScrollSheet>
            <Table>
              <TableHeader>
                <TableRow className="ledger-head">
                  <TableHead className="w-28">DN</TableHead>
                  <TableHead className="w-36">Issued</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="w-32">Sale</TableHead>
                  <TableHead className="w-28">Store</TableHead>
                  <TableHead className="numeric w-20">Lines</TableHead>
                  <TableHead className="numeric w-24">Qty</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-24 print:hidden" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <ClickableRow
                    key={row.id}
                    href={row.href}
                    className={index % 2 === 1 ? 'ledger-row-alt' : 'ledger-row'}
                  >
                    <TableCell className="font-medium tabular">{row.number}</TableCell>
                    <TableCell className="tabular text-muted-foreground">
                      <div>{formatDate(row.date)}</div>
                      <div className="text-xs">{formatDateTime(new Date(row.issuedAt), ctx.organization.timeZone)}</div>
                    </TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell className="tabular">
                      <Link
                        href={saleHref(row.salesType, row.salesDocumentId)}
                        className="underline-offset-4 hover:underline"
                      >
                        {row.salesNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{row.storeName ?? '—'}</TableCell>
                    <TableCell className="numeric tabular">{row.lineCount}</TableCell>
                    <TableCell className="numeric tabular">{row.quantity}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'POSTED' ? 'success' : 'secondary'}>
                        {row.status === 'POSTED' ? 'Issued' : 'Void'}
                      </Badge>
                    </TableCell>
                    <TableCell className="print:hidden">
                      <Link
                        href={row.printHref}
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                      >
                        Print
                      </Link>
                    </TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollSheet>
        </Card>
      )}
    </div>
  )
}

function saleHref(type: string, id: string) {
  if (type === 'SALES_RECEIPT') return `/sales/sales-receipts/${id}`
  return `/sales/invoices/${id}`
}

function Insight({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string
  value: string
  hint: string
  icon: ReactNode
  tone: 'stock' | 'info' | 'ledger'
}) {
  return (
    <Card tone={tone}>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="mt-0.5 rounded-md bg-black/5 p-2 dark:bg-white/10">{icon}</span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tabular">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { DeliveryNoteEditForm } from '@/app/(app)/sales/delivery/note-edit-form'
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
import { formatDate, formatDateTime } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as salesDelivery from '@/server/services/sales-delivery.service'

export const metadata: Metadata = { title: 'Delivery note' }

export default async function DeliveryNotePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext('invoice:read')
  const { id } = await params
  const note = await salesDelivery.get(ctx, id).catch(() => null)
  if (!note) notFound()

  const canEdit = ctx.permissions.has('invoice:update') && note.status === 'POSTED'
  const saleHref =
    note.salesType === 'SALES_RECEIPT'
      ? `/sales/sales-receipts/${note.salesDocumentId}`
      : `/sales/invoices/${note.salesDocumentId}`

  return (
    <>
      <PageHeader
        title={`Delivery note ${note.number}`}
        description={`${note.customerName} · ${formatDate(note.date)} · issued ${formatDateTime(new Date(note.issuedAt), ctx.organization.timeZone)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant={note.status === 'POSTED' ? 'success' : 'secondary'}>
              {note.status === 'POSTED' ? 'Issued' : 'Void'}
            </Badge>
            <Link href={note.printHref} className={buttonVariants({ size: 'sm' })}>
              Print / PDF
            </Link>
            <Link href={saleHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Open {note.salesNumber}
            </Link>
            <Link
              href={`/customers?id=${note.customerId}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Customer
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="ledger-head">
                <TableHead className="w-12">#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-32">Store</TableHead>
                <TableHead className="numeric w-24">Qty</TableHead>
                <TableHead className="w-28">Ticket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {note.lines.map((line, index) => (
                <TableRow key={line.lineNumber} className={index % 2 === 1 ? 'ledger-row-alt' : 'ledger-row'}>
                  <TableCell className="tabular text-muted-foreground">{line.lineNumber}</TableCell>
                  <TableCell className="font-medium">{line.itemName ?? '—'}</TableCell>
                  <TableCell>{line.description ?? '—'}</TableCell>
                  <TableCell>{line.storeName ?? '—'}</TableCell>
                  <TableCell className="numeric tabular">{line.quantity}</TableCell>
                  <TableCell className="tabular">
                    {line.ticketId ? (
                      <Link
                        href={`/stores/tickets/${line.ticketId}/print`}
                        className="underline-offset-4 hover:underline"
                      >
                        {line.ticketNumber}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 text-sm">
            <h2 className="font-semibold">Deliver to</h2>
            <p className="mt-2 font-medium">{note.customerName}</p>
            {note.shipping.map((line) => (
              <p key={line} className="text-muted-foreground">
                {line}
              </p>
            ))}
            {note.customerPhone ? <p className="mt-2">Phone {note.customerPhone}</p> : null}
            {note.customerEmail ? <p className="text-muted-foreground">{note.customerEmail}</p> : null}
            <p className="mt-3 text-muted-foreground">
              Sale <Link href={saleHref} className="font-medium text-foreground underline-offset-4 hover:underline">{note.salesNumber}</Link>
            </p>
            {note.storeName ? <p className="text-muted-foreground">From {note.storeName}</p> : null}
          </div>
          {canEdit ? (
            <DeliveryNoteEditForm id={note.id} carrier={note.carrier} notes={note.notes} />
          ) : (
            <div className="rounded-xl border bg-card p-4 text-sm">
              <h2 className="font-semibold">Carrier & notes</h2>
              <p className="mt-2">{note.carrier || '—'}</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{note.notes || 'No notes.'}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

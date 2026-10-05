import { notFound } from 'next/navigation'
import Link from 'next/link'

import { DocumentActions } from '@/components/print/document-actions'
import { formatDate, formatDateTime, toCalendarDate } from '@/lib/date'
import { Decimal } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'
import * as salesDelivery from '@/server/services/sales-delivery.service'

export const metadata = { title: 'Print store ticket' }

/**
 * Store issue ticket — one item leaving a shelf. Raised automatically on sale
 * or transfer; printable for the counter and the truck.
 */
export default async function PrintStoreTicketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext('inventory:read')
  const { id } = await params
  const [ticket, organization] = await Promise.all([
    salesDelivery.getTicket(ctx, id).catch(() => null),
    organizationService.get(ctx),
  ])
  if (!ticket) notFound()

  const qty = new Decimal(ticket.quantity.toString()).toFixed(2)
  const date = toCalendarDate(ticket.date)
  const issued = formatDateTime(ticket.createdAt, organization.timeZone)
  const originLabel =
    ticket.origin === 'SALE' ? 'Sale issue' : ticket.origin === 'MANUAL' ? 'Manual ticket' : 'Transfer'

  const shareBody = [
    `Store ticket ${ticket.number}`,
    `Item: ${ticket.item.name}`,
    `Qty: ${qty}`,
    `From: ${ticket.store.name}`,
    ticket.toStore ? `To: ${ticket.toStore.name}` : null,
    ticket.customerName ? `Customer: ${ticket.customerName}` : null,
    ticket.salesDocument ? `Invoice: ${ticket.salesDocument.number}` : null,
    ticket.deliveryNote ? `Delivery: ${ticket.deliveryNote.number}` : null,
    ticket.sellerName ? `Sold by: ${ticket.sellerName}` : null,
    `Date: ${formatDate(date)} · ${issued}`,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 print:hidden">
        <DocumentActions
          paper="store ticket"
          backHref={
            ticket.deliveryNote
              ? `/sales/delivery/${ticket.deliveryNote.id}`
              : `/stores/${ticket.store.id}`
          }
          filename={`ticket-${ticket.number.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`}
          defaultSubject={`Store ticket ${ticket.number} — ${ticket.item.name}`}
          defaultBody={shareBody}
          whatsappText={shareBody}
        />
      </div>

      <article className="relative overflow-hidden rounded-2xl border border-[#1B3A4B]/15 bg-gradient-to-b from-[#f0f7fb] to-white text-[#1B3A4B] shadow-[0_16px_40px_-20px_rgb(15_23_42/0.35)] print:shadow-none">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[#3A7CA8]" />
        <div className="px-8 pb-10 pt-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#3A7CA8]">
                Store ticket
              </p>
              <h1 className="mt-1 text-3xl font-bold tabular tracking-tight">{ticket.number}</h1>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-[#5C6B7A]">
                {originLabel}
              </p>
            </div>
            <div className="text-right text-xs text-[#5C6B7A]">
              <p className="font-semibold text-[#1B3A4B]">{organization.name}</p>
              <p>{formatDate(date)}</p>
              <p>{issued}</p>
            </div>
          </div>

          <div className="mt-8 rounded-xl bg-[#1B3A4B] px-5 py-4 text-white">
            <p className="text-[0.65rem] uppercase tracking-[0.16em] text-white/70">Item</p>
            <p className="mt-1 text-xl font-semibold leading-snug">{ticket.item.name}</p>
            {ticket.item.sku ? (
              <p className="mt-1 text-sm tabular text-white/70">SKU {ticket.item.sku}</p>
            ) : null}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-[#c5dff3] bg-white/80 px-3 py-2.5">
              <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-[#5C6B7A]">
                Quantity
              </dt>
              <dd className="mt-0.5 text-2xl font-bold tabular">{qty}</dd>
            </div>
            <div className="rounded-lg border border-[#c5dff3] bg-white/80 px-3 py-2.5">
              <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-[#5C6B7A]">
                From store
              </dt>
              <dd className="mt-0.5 text-lg font-semibold">{ticket.store.name}</dd>
            </div>
            {ticket.toStore ? (
              <div className="col-span-2 rounded-lg border border-[#c5dff3] bg-white/80 px-3 py-2.5">
                <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-[#5C6B7A]">
                  To store
                </dt>
                <dd className="mt-0.5 text-lg font-semibold">{ticket.toStore.name}</dd>
              </div>
            ) : null}
            {ticket.customerName ? (
              <div className="col-span-2 rounded-lg border border-[#c5dff3] bg-white/80 px-3 py-2.5">
                <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-[#5C6B7A]">
                  Customer
                </dt>
                <dd className="mt-0.5 font-semibold">{ticket.customerName}</dd>
              </div>
            ) : null}
            {ticket.sellerName ? (
              <div className="col-span-2 rounded-lg border border-[#c5dff3] bg-white/80 px-3 py-2.5">
                <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-[#5C6B7A]">
                  Sold by
                </dt>
                <dd className="mt-0.5 font-semibold">{ticket.sellerName}</dd>
              </div>
            ) : null}
          </dl>

          {(ticket.salesDocument || ticket.deliveryNote || ticket.memo) && (
            <div className="mt-6 space-y-1 border-t border-[#c5dff3] pt-4 text-sm">
              {ticket.salesDocument ? (
                <p>
                  Invoice / receipt{' '}
                  <span className="font-semibold tabular">{ticket.salesDocument.number}</span>
                </p>
              ) : null}
              {ticket.deliveryNote ? (
                <p>
                  Delivery note{' '}
                  <Link
                    href={`/sales/delivery/${ticket.deliveryNote.id}/print`}
                    className="font-semibold tabular underline-offset-4 hover:underline print:no-underline"
                  >
                    {ticket.deliveryNote.number}
                  </Link>
                </p>
              ) : null}
              {ticket.memo ? <p className="text-[#5C6B7A]">{ticket.memo}</p> : null}
              {ticket.deliveryNote?.notes ? (
                <p className="text-[#5C6B7A]">{ticket.deliveryNote.notes}</p>
              ) : null}
              {ticket.preparedAt ? (
                <p className="text-xs font-medium text-[#3A7CA8]">
                  Prepared {formatDateTime(ticket.preparedAt, organization.timeZone)}
                </p>
              ) : null}
            </div>
          )}

          <div className="mt-10 grid grid-cols-2 gap-6">
            <div>
              <div className="h-px bg-[#1B3A4B]/35" />
              <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-[#5C6B7A]">
                {ticket.sellerName ? `Sold by ${ticket.sellerName}` : 'Issued by'}
              </p>
            </div>
            <div>
              <div className="h-px bg-[#1B3A4B]/35" />
              <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-[#5C6B7A]">
                Received by customer
              </p>
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}

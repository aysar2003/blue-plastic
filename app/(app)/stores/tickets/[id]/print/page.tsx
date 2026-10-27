import { notFound } from 'next/navigation'
import Link from 'next/link'

import { DocumentActions } from '@/components/print/document-actions'
import { DocumentBarcode } from '@/components/print/document-barcode'
import { formatDate, formatDateTime, toCalendarDate } from '@/lib/date'
import { paperAccent } from '@/lib/document-template'
import { letterheadOf } from '@/lib/letterhead'
import { orgLogoUrl } from '@/lib/org-brand'
import { formatQty } from '@/lib/quantity'
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
  const [ticket, organization, template] = await Promise.all([
    salesDelivery.getTicket(ctx, id).catch(() => null),
    organizationService.get(ctx),
    organizationService.getPrintTemplate(ctx),
  ])
  if (!ticket) notFound()

  const company = letterheadOf(organization)
  const accent = paperAccent(template, 'customer')
  const logoSrc = orgLogoUrl(Boolean(organization.logoStorageKey), organization.updatedAt)
  const qty = formatQty(ticket.quantity.toString(), ticket.item.unitOfMeasure)
  const date = toCalendarDate(ticket.date)
  const issued = formatDateTime(ticket.createdAt, organization.timeZone)
  const originLabel =
    ticket.origin === 'SALE' ? 'Sale issue' : ticket.origin === 'MANUAL' ? 'Manual ticket' : 'Transfer'
  const party = ticket.customerName || ticket.toStore?.name || ticket.store.name
  const remarks = ticket.memo?.trim() || ticket.deliveryNote?.notes?.trim() || '—'

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
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 print:hidden">
        <DocumentActions
          paper="store ticket"
          backHref={
            ticket.deliveryNote
              ? `/sales/delivery/${ticket.deliveryNote.id}`
              : `/stores/${ticket.store.id}`
          }
          pdfHref={`/api/stores/tickets/${id}/pdf`}
          paperStyle={template.paperStyle}
          filename={`ticket-${ticket.number.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`}
          pdfMatchesPrint
          defaultSubject={`Store ticket ${ticket.number} — ${ticket.item.name}`}
          defaultBody={shareBody}
          whatsappText={shareBody}
        />
      </div>

      <article className="merchant-invoice bg-white px-10 pb-6 pt-8 text-[12px] leading-snug text-[#374151] shadow-[0_12px_40px_rgb(15_23_42/0.08)] print:shadow-none">
        <div className="flex items-start justify-between gap-6">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: accent }}>
            {company.name}
          </h1>
          <div className="text-right text-[11px] leading-5 text-[#3d4c5c]">
            {company.phone ? <p>TEL: {company.phone}</p> : null}
            {company.email ? <p>EMAIL: {company.email}</p> : null}
            {company.address ? <p>ADDR: {company.address}</p> : null}
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_16rem]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
              {ticket.toStore ? 'Transfer to' : 'Issue to'}
            </p>
            <p className="mt-1 text-sm font-semibold">{party}</p>
            <dl className="mt-3 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-y-1 text-[12px]">
              <dt className="text-[#5C6B7A]">From store</dt>
              <dd>{ticket.store.name}</dd>
              {ticket.toStore ? (
                <>
                  <dt className="text-[#5C6B7A]">To store</dt>
                  <dd>{ticket.toStore.name}</dd>
                </>
              ) : null}
              {ticket.customerName ? (
                <>
                  <dt className="text-[#5C6B7A]">Customer</dt>
                  <dd>{ticket.customerName}</dd>
                </>
              ) : null}
            </dl>
          </div>
          <div className="text-right">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt="" className="mb-2 ml-auto h-12 w-14 object-contain" />
            ) : null}
            <p className="text-lg font-black tracking-wide" style={{ color: accent }}>
              STORE TICKET
            </p>
            <p className="mt-1 font-semibold">{ticket.number}</p>
            <div className="mt-2 flex justify-end">
              <DocumentBarcode value={ticket.number} height={40} moduleWidth={1.15} />
            </div>
            <p className="mt-2 inline-block rounded px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: accent }}>
              {originLabel.toUpperCase()}
            </p>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: accent }}>
              Date
            </p>
            <p>
              {formatDate(date)} · {issued}
            </p>
          </div>
        </div>

        <h2 className="mt-6 text-[22px] font-normal tracking-tight text-[#111827]">
          STORE TICKET #{ticket.number}
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="font-semibold text-[#111827]">From store:</p>
            <p className="mt-1">{ticket.store.name}</p>
          </div>
          <div>
            <p className="font-semibold text-[#111827]">{ticket.toStore ? 'To store:' : 'Customer:'}</p>
            <p className="mt-1">{ticket.toStore?.name || ticket.customerName || '—'}</p>
          </div>
          <div>
            <p className="font-semibold text-[#111827]">Order Date:</p>
            <p className="mt-1">{formatDate(date)} · {issued}</p>
          </div>
        </div>

        <p className="mt-4">
          <span className="font-semibold">Remarks:</span> {remarks}
        </p>
        {ticket.salesDocument || ticket.deliveryNote ? (
          <p className="mt-1">
            {ticket.salesDocument ? <span>Invoice {ticket.salesDocument.number}. </span> : null}
            {ticket.deliveryNote ? (
              <>
                Delivery{' '}
                <Link href={`/sales/delivery/${ticket.deliveryNote.id}/print`} className="underline print:no-underline">
                  {ticket.deliveryNote.number}
                </Link>
                .
              </>
            ) : null}
          </p>
        ) : null}

        <div className="mt-4">
          <div className="grid grid-cols-[minmax(0,1fr)_6rem_5rem] gap-x-2 border-b border-[#9ca3af] py-1 font-semibold text-[#111827]">
            <span>Description</span>
            <span className="text-right">SKU</span>
            <span className="text-right">Qty</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_6rem_5rem] gap-x-2 py-1.5">
            <span>{ticket.item.name}</span>
            <span className="text-right">{ticket.item.sku || '—'}</span>
            <span className="tabular text-right">{qty}</span>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8">
          <div className="border-t border-[#d1d5db] pt-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5C6B7A]">
              {ticket.sellerName ? `Issued by ${ticket.sellerName}` : 'Issued by'}
            </p>
          </div>
          <div className="border-t border-[#d1d5db] pt-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5C6B7A]">Received by</p>
          </div>
        </div>
      </article>
    </div>
  )
}

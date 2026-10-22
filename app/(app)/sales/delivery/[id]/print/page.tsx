import { notFound } from 'next/navigation'
import Link from 'next/link'

import { DocumentActions } from '@/components/print/document-actions'
import { DocumentBarcode } from '@/components/print/document-barcode'
import { formatDate, formatDateTime } from '@/lib/date'
import { accentWash, paperAccent } from '@/lib/document-template'
import { letterheadOf } from '@/lib/letterhead'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'
import * as salesDelivery from '@/server/services/sales-delivery.service'

export const metadata = { title: 'Print delivery note' }

/**
 * Customer / carrier facing delivery note on the same merchant paper as
 * invoices — Print and PDF stay one document.
 */
export default async function PrintDeliveryNotePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const { id } = await params
  const [note, organization, template] = await Promise.all([
    salesDelivery.get(ctx, id).catch(() => null),
    organizationService.get(ctx),
    organizationService.getDocumentTemplate(ctx),
  ])
  if (!note) notFound()

  const company = letterheadOf(organization)
  const accent = paperAccent(template, 'customer')
  const wash = accentWash(accent)
  const issued = formatDateTime(new Date(note.issuedAt), organization.timeZone)
  const filename = `delivery-note-${note.number.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
  const shareBody = [
    `Delivery note ${note.number}`,
    `Customer: ${note.customerName}`,
    `Sale: ${note.salesNumber}`,
    `Date: ${formatDate(note.date)} · ${issued}`,
    `Lines: ${note.lineCount} · Qty ${note.quantity}`,
    note.carrier ? `Carrier: ${note.carrier}` : null,
    '',
    `From ${organization.legalName ?? organization.name}`,
  ]
    .filter((line) => line !== null)
    .join('\n')

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 print:hidden">
        <DocumentActions
          paper="delivery note"
          backHref={`/sales/delivery/${id}`}
          pdfHref={`/api/sales/delivery/${id}/pdf`}
          filename={filename}
          pdfMatchesPrint
          defaultTo={note.customerEmail ?? ''}
          defaultSubject={`Delivery note ${note.number} from ${organization.name}`}
          defaultBody={shareBody}
          whatsappPhone={note.customerPhone}
          whatsappText={shareBody}
        />
      </div>

      <article
        className="merchant-invoice relative overflow-hidden bg-white text-[13px] text-[#1f2933] shadow-[0_12px_40px_rgb(15_23_42/0.08)] print:overflow-visible print:shadow-none"
        style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
      >
        <div className="flex items-start justify-between gap-6 px-8 pb-4 pt-6">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: accent }}>
            {company.name}
          </h1>
          <div className="text-right text-[11px] leading-5 text-[#3d4c5c]">
            {company.phone ? <p>TEL: {company.phone}</p> : null}
            {company.email ? <p>EMAIL: {company.email}</p> : null}
            {company.address ? <p>ADDR: {company.address}</p> : null}
          </div>
        </div>

        <div className="grid gap-6 px-8 sm:grid-cols-[minmax(0,1fr)_16rem]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
              Deliver to
            </p>
            <p className="mt-1 text-sm font-semibold">{note.customerName}</p>
            <dl className="mt-3 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-y-1 text-[12px]">
              {note.shipping.map((line) => (
                <Meta key={line} label="Address" value={line} />
              ))}
              <Meta label="Phone" value={note.customerPhone || '—'} />
            </dl>
          </div>
          <div className="text-right">
            <p className="text-lg font-black tracking-wide" style={{ color: accent }}>
              DELIVERY NOTE
            </p>
            <p className="mt-1 font-semibold">{note.number}</p>
            <div className="mt-2 flex justify-end">
              <DocumentBarcode value={note.number} height={40} moduleWidth={1.15} />
            </div>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: accent }}>
              Date
            </p>
            <p>
              {formatDate(note.date)} · {issued}
            </p>
            <p className="mt-2 text-sm">
              Sale <span className="font-semibold tabular">{note.salesNumber}</span>
            </p>
            {note.storeName ? (
              <p className="text-sm text-[#5C6B7A]">From store {note.storeName}</p>
            ) : null}
            {note.carrier ? (
              <p className="mt-1 text-sm">
                Carrier <span className="font-medium">{note.carrier}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="mx-8 mt-6">
          <div
            className="grid grid-cols-[2rem_minmax(0,1fr)_7rem_5rem_6rem] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white"
            style={{ background: accent }}
          >
            <span>No</span>
            <span>Item / description</span>
            <span>Store</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Ticket</span>
          </div>
          {note.lines.map((line, index) => (
            <div
              key={line.lineNumber}
              className="grid grid-cols-[2rem_minmax(0,1fr)_7rem_5rem_6rem] items-center px-2 py-1.5 text-[12px]"
              style={{ background: index % 2 === 0 ? '#ffffff' : wash }}
            >
              <span className="tabular text-[#5C6B7A]">{line.lineNumber}</span>
              <span className="pr-2">
                <span className="font-medium">{line.itemName ?? line.description ?? '—'}</span>
                {line.itemName && line.description && line.description !== line.itemName ? (
                  <span className="mt-0.5 block text-[11px] text-[#5C6B7A]">{line.description}</span>
                ) : null}
              </span>
              <span className="text-[#5C6B7A]">{line.storeName ?? '—'}</span>
              <span className="tabular text-right font-medium">{line.quantity}</span>
              <span className="tabular text-right text-[#5C6B7A]">{line.ticketNumber ?? '—'}</span>
            </div>
          ))}
        </div>

        {note.notes || note.carrier ? (
          <div className="mx-8 mt-6 border border-dashed px-4 py-3" style={{ borderColor: `${accent}66` }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
              Notes / instructions
            </p>
            {note.carrier ? (
              <p className="mt-1 text-sm">
                <span className="font-medium">Carrier:</span> {note.carrier}
              </p>
            ) : null}
            {note.notes ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-[#3d4c5c]">{note.notes}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-10 grid break-inside-avoid gap-8 px-8 sm:grid-cols-2">
          <div className="border-t border-[#d1d5db] pt-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5C6B7A]">Dispatched by</p>
            <div className="mt-8 h-px bg-[#d1d5db]" />
            <p className="mt-1 text-xs text-[#5C6B7A]">Name / signature</p>
          </div>
          <div className="border-t border-[#d1d5db] pt-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5C6B7A]">Received by</p>
            <div className="mt-8 h-px bg-[#d1d5db]" />
            <p className="mt-1 text-xs text-[#5C6B7A]">Name / signature / date</p>
          </div>
        </div>

        <p className="mt-8 px-8 pb-6 text-center text-[11px] text-[#5C6B7A]">
          This delivery note accompanies goods for sale{' '}
          <Link href={`/sales/delivery/${id}`} className="underline print:no-underline">
            {note.salesNumber}
          </Link>
          . It is not a tax invoice.
        </p>
      </article>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[#5C6B7A]">{label}</dt>
      <dd>{value}</dd>
    </>
  )
}

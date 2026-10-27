import { notFound } from 'next/navigation'
import Link from 'next/link'

import { DocumentActions } from '@/components/print/document-actions'
import { DocumentBarcode } from '@/components/print/document-barcode'
import { formatDate, formatDateTime } from '@/lib/date'
import { paperAccent } from '@/lib/document-template'
import { letterheadOf } from '@/lib/letterhead'
import { orgLogoUrl } from '@/lib/org-brand'
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
    organizationService.getPrintTemplate(ctx),
  ])
  if (!note) notFound()

  const company = letterheadOf(organization)
  const accent = paperAccent(template, 'customer')
  const logoSrc = orgLogoUrl(
    Boolean(organization.logoStorageKey),
    organization.updatedAt,
  )
  const status = note.status.replaceAll('_', ' ').toUpperCase()
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
          paperStyle={template.paperStyle}
          defaultTo={note.customerEmail ?? ''}
          defaultSubject={`Delivery note ${note.number} from ${organization.name}`}
          defaultBody={shareBody}
          whatsappPhone={note.customerPhone}
          whatsappText={shareBody}
        />
      </div>

      <article
        className="merchant-invoice bg-white px-10 pb-6 pt-8 text-[12px] leading-snug text-[#374151] shadow-[0_12px_40px_rgb(15_23_42/0.08)] print:shadow-none"
        style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
      >
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
              Deliver to
            </p>
            <p className="mt-1 text-sm font-semibold">{note.customerName}</p>
            <dl className="mt-3 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-y-1 text-[12px]">
              {note.shipping.map((line) => (
                <Meta key={line} label="Address" value={line} />
              ))}
              {note.customerPhone ? <Meta label="Phone" value={note.customerPhone} /> : null}
            </dl>
          </div>
          <div className="text-right">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt="" className="mb-2 ml-auto h-12 w-14 object-contain" />
            ) : null}
            <p className="text-lg font-black tracking-wide" style={{ color: accent }}>
              DELIVERY NOTE
            </p>
            <p className="mt-1 font-semibold">{note.number}</p>
            <div className="mt-2 flex justify-end">
              <DocumentBarcode value={note.number} height={40} moduleWidth={1.15} />
            </div>
            <p className="mt-2 inline-block rounded px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: accent }}>
              {status}
            </p>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: accent }}>
              Date
            </p>
            <p>
              {formatDate(note.date)} · {issued}
            </p>
          </div>
        </div>

        <h2 className="mt-6 text-[22px] font-normal tracking-tight text-[#111827]">
          DELIVERY NOTE #{note.number}
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="font-semibold text-[#111827]">Sale:</p>
            <p className="mt-1">{note.salesNumber}</p>
          </div>
          <div>
            <p className="font-semibold text-[#111827]">Carrier:</p>
            <p className="mt-1">{note.carrier?.trim() || '—'}</p>
          </div>
          <div>
            <p className="font-semibold text-[#111827]">Order Date:</p>
            <p className="mt-1">{formatDate(note.date)} · {issued}</p>
          </div>
        </div>

        <p className="mt-4">
          <span className="font-semibold">Remarks:</span>
          <span className="whitespace-pre-wrap">
            {note.notes?.trim() || (note.storeName ? `From store ${note.storeName}.` : '—')}
          </span>
        </p>

        <div className="mt-4">
          <div className="grid grid-cols-[minmax(0,1.4fr)_7rem_4.5rem_6rem] gap-x-2 border-b border-[#9ca3af] py-1 text-[12px] font-semibold text-[#111827]">
            <span>Description</span>
            <span>Store</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Ticket</span>
          </div>
          {note.lines.map((line, index) => (
            <div
              key={line.lineNumber}
              className="grid grid-cols-[minmax(0,1.4fr)_7rem_4.5rem_6rem] gap-x-2 items-start py-1.5"
              style={{ background: index % 2 === 0 ? '#ffffff' : '#f3f4f6' }}
            >
              <span className="pr-2">
                {line.itemName ?? line.description ?? '—'}
                {line.itemName && line.description && line.description !== line.itemName
                  ? ` — ${line.description}`
                  : ''}
              </span>
              <span>{line.storeName ?? '—'}</span>
              <span className="tabular text-right">{line.quantity}</span>
              <span className="tabular text-right">{line.ticketNumber ?? '—'}</span>
            </div>
          ))}
        </div>

        <div className="mt-10 grid break-inside-avoid gap-8 sm:grid-cols-2">
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

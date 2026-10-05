import { notFound } from 'next/navigation'
import Link from 'next/link'

import { SheetMarks } from '@/components/sales/sheet-marks'
import { formatDate, formatDateTime } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'
import * as salesDelivery from '@/server/services/sales-delivery.service'
import { DocumentActions } from '@/components/print/document-actions'

export const metadata = { title: 'Print delivery note' }

/**
 * Customer / carrier facing delivery note — ISO-style packing advice.
 * Browser print / Save as PDF; no headless renderer.
 */
export default async function PrintDeliveryNotePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const { id } = await params
  const [note, organization] = await Promise.all([
    salesDelivery.get(ctx, id).catch(() => null),
    organizationService.get(ctx),
  ])
  if (!note) notFound()

  const seller = [
    [organization.addressLine1, organization.addressLine2].filter(Boolean).join(', '),
    [organization.city, organization.region, organization.postalCode].filter(Boolean).join(' '),
    organization.country,
  ].filter(Boolean)

  const issued = formatDateTime(new Date(note.issuedAt), organization.timeZone)
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
          filename={`delivery-note-${note.number.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`}
          defaultTo={note.customerEmail ?? ''}
          defaultSubject={`Delivery note ${note.number} from ${organization.name}`}
          defaultBody={shareBody}
          whatsappPhone={note.customerPhone}
          whatsappText={shareBody}
        />
      </div>

      <article className="invoice-sheet relative min-h-[900px] overflow-hidden bg-white text-[#1B3A4B] shadow-[0_12px_40px_rgb(15_23_42/0.08)] print:min-h-0 print:shadow-none">
        <SheetMarks />

        <div className="relative px-8 pb-16 pt-10 sm:px-12">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[#1B3A4B]/20 pb-6">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#3A7CA8]">
                Delivery note
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight tabular">{note.number}</h1>
              <p className="mt-1 text-sm text-[#5C6B7A]">
                {formatDate(note.date)} · {issued}
              </p>
            </div>
            <div className="max-w-xs text-right">
              <h2 className="text-lg font-bold uppercase tracking-wide">
                {organization.legalName ?? organization.name}
              </h2>
              {seller.map((line) => (
                <p key={line} className="text-sm text-[#5C6B7A]">
                  {line}
                </p>
              ))}
              {organization.phone ? <p className="text-sm text-[#5C6B7A]">Phone {organization.phone}</p> : null}
            </div>
          </header>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <section>
              <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#3A7CA8]">
                Deliver to
              </h3>
              <p className="mt-2 text-base font-semibold">{note.customerName}</p>
              {note.shipping.map((line) => (
                <p key={line} className="text-sm text-[#5C6B7A]">
                  {line}
                </p>
              ))}
              {note.customerPhone ? <p className="mt-1 text-sm">Tel. {note.customerPhone}</p> : null}
            </section>
            <section className="sm:text-right">
              <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#3A7CA8]">
                References
              </h3>
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
            </section>
          </div>

          <table className="mt-8 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#1B3A4B] text-left text-[0.65rem] font-semibold uppercase tracking-wider text-white">
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Item / description</th>
                <th className="px-3 py-2.5">Store</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5">Ticket</th>
              </tr>
            </thead>
            <tbody>
              {note.lines.map((line, index) => (
                <tr
                  key={line.lineNumber}
                  className={index % 2 === 1 ? 'bg-[#eef5f9]' : 'bg-white'}
                >
                  <td className="border-b border-[#d5dde6] px-3 py-2 tabular text-[#5C6B7A]">
                    {line.lineNumber}
                  </td>
                  <td className="border-b border-[#d5dde6] px-3 py-2">
                    <div className="font-medium">{line.itemName ?? line.description ?? '—'}</div>
                    {line.itemName && line.description && line.description !== line.itemName ? (
                      <div className="text-xs text-[#5C6B7A]">{line.description}</div>
                    ) : null}
                  </td>
                  <td className="border-b border-[#d5dde6] px-3 py-2 text-[#5C6B7A]">
                    {line.storeName ?? '—'}
                  </td>
                  <td className="border-b border-[#d5dde6] px-3 py-2 text-right tabular font-medium">
                    {line.quantity}
                  </td>
                  <td className="border-b border-[#d5dde6] px-3 py-2 tabular text-[#5C6B7A]">
                    {line.ticketNumber ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(note.notes || note.carrier) && (
            <section className="mt-8 rounded-lg border border-dashed border-[#3A7CA8]/40 bg-[#f4f9fc] px-4 py-3">
              <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#3A7CA8]">
                Notes / instructions
              </h3>
              {note.carrier ? (
                <p className="mt-1 text-sm">
                  <span className="font-medium">Carrier:</span> {note.carrier}
                </p>
              ) : null}
              {note.notes ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#1B3A4B]">{note.notes}</p>
              ) : null}
            </section>
          )}

          <footer className="mt-12 grid gap-8 sm:grid-cols-2">
            <div className="border-t border-[#1B3A4B]/25 pt-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#5C6B7A]">
                Dispatched by
              </p>
              <div className="mt-8 h-px bg-[#1B3A4B]/30" />
              <p className="mt-1 text-xs text-[#5C6B7A]">Name / signature</p>
            </div>
            <div className="border-t border-[#1B3A4B]/25 pt-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#5C6B7A]">
                Received by
              </p>
              <div className="mt-8 h-px bg-[#1B3A4B]/30" />
              <p className="mt-1 text-xs text-[#5C6B7A]">Name / signature / date</p>
            </div>
          </footer>

          <p className="mt-10 text-center text-[0.7rem] text-[#5C6B7A]">
            This delivery note accompanies goods for sale{' '}
            <Link href={`/sales/delivery/${id}`} className="underline print:no-underline">
              {note.salesNumber}
            </Link>
            . It is not a tax invoice.
          </p>
        </div>
      </article>
    </div>
  )
}

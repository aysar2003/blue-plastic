import { notFound } from 'next/navigation'

import { toCalendarDate, toDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { bySlug, defaultLineRows } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'
import * as salesService from '@/server/services/sales.service'
import { SheetMarks } from '@/components/sales/sheet-marks'
import { PrintButton } from './print-button'

export const metadata = { title: 'Print' }

/**
 * The customer-facing document, in the sales sheet style: the business name
 * at the top right, a navy line table, and the totals stacked beneath it.
 *
 * Printed by the browser. Saving as PDF is the same dialog, so the layout
 * stays in CSS.
 */
export default async function PrintDocumentPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>
}) {
  const { type, id } = await params
  const config = bySlug(type)
  if (!config) notFound()

  const ctx = await requireOrgContext('invoice:read')
  const [document, organization] = await Promise.all([
    salesService.get(ctx, id).catch(() => null),
    organizationService.get(ctx),
  ])
  if (!document) notFound()

  const currency = document.currencyCode || ctx.organization.baseCurrency
  const customer = document.customer
  const money = (value: string | number) => formatMoney(value, currency)
  const hasDiscount = Number(document.discountAmount) > 0
  const hasTax = Number(document.taxTotal) > 0
  const hasPayment = config.type === 'INVOICE' && Number(document.amountApplied) > 0

  const seller = [
    [organization.addressLine1, organization.addressLine2].filter(Boolean).join(', '),
    [organization.city, organization.region, organization.postalCode].filter(Boolean).join(' '),
    organization.country,
  ].filter(Boolean)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <article className="invoice-sheet relative min-h-[920px] overflow-hidden bg-white text-[#1B3A4B] shadow-[0_12px_40px_rgb(15_23_42/0.08)] print:min-h-0 print:shadow-none">
        <SheetMarks />

        <div className="relative px-8 pb-24 pt-12 sm:px-12">
          <header className="flex justify-end">
            <div className="max-w-md text-right">
              <h1 className="text-[1.7rem] font-bold uppercase leading-tight tracking-[0.04em]">
                {organization.legalName ?? organization.name}
              </h1>
              {seller.map((line) => (
                <p key={line} className="text-sm text-[#5C6B7A]">
                  {line}
                </p>
              ))}
              {organization.phone ? <p className="text-sm text-[#5C6B7A]">Phone {organization.phone}</p> : null}
              {organization.email ? <p className="text-sm text-[#5C6B7A]">Email {organization.email}</p> : null}
              {organization.taxRegistrationNumber ? (
                <p className="text-sm text-[#5C6B7A]">Tax reg. {organization.taxRegistrationNumber}</p>
              ) : null}
              <p className="mt-8 text-xl font-bold uppercase tracking-[0.18em] text-[#0E8A6A]">
                {config.singular}
              </p>
              <p className="mt-1 text-lg font-semibold tracking-wide">{document.number}</p>
              {document.status === 'DRAFT' ? (
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#0E8A6A]">Draft</p>
              ) : null}
            </div>
          </header>

          <dl className="mt-10 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="font-bold uppercase tracking-[0.12em] text-[#0E8A6A]">Billed to</dt>
            <dd className="text-[#5C6B7A]">
              <span className="text-[#3d4c5c]">{customer.displayName}</span>
              {customer.billingLine1 ? <span className="mt-0.5 block">{customer.billingLine1}</span> : null}
              {customer.billingCity ? <span className="block">{customer.billingCity}</span> : null}
              {customer.email ? <span className="block">{customer.email}</span> : null}
            </dd>
            <dt className="font-bold uppercase tracking-[0.12em] text-[#0E8A6A]">Date</dt>
            <dd className="text-[#5C6B7A]">{longDate(toCalendarDate(document.date))}</dd>
            {document.dueDate ? (
              <>
                <dt className="font-bold uppercase tracking-[0.12em] text-[#0E8A6A]">Due</dt>
                <dd className="text-[#5C6B7A]">{longDate(toCalendarDate(document.dueDate))}</dd>
              </>
            ) : null}
            {document.expiryDate && config.type === 'ESTIMATE' ? (
              <>
                <dt className="font-bold uppercase tracking-[0.12em] text-[#0E8A6A]">Valid until</dt>
                <dd className="text-[#5C6B7A]">{longDate(toCalendarDate(document.expiryDate))}</dd>
              </>
            ) : null}
            {document.reference ? (
              <>
                <dt className="font-bold uppercase tracking-[0.12em] text-[#0E8A6A]">Reference</dt>
                <dd className="text-[#5C6B7A]">{document.reference}</dd>
              </>
            ) : null}
          </dl>

          <div className="mt-8">
            <div className="grid grid-cols-[3.25rem_4.5rem_minmax(0,1fr)_5.75rem_4.75rem_6.25rem] bg-[#3A7CA8] px-2 py-2 text-[13px] font-medium text-white">
              <span className="text-center">Qty</span>
              <span>Item #</span>
              <span>Description</span>
              <span className="text-right">Unit Price</span>
              <span className="text-right">Discount</span>
              <span className="text-right">Line Total</span>
            </div>
            <div>
              {paddedLines(document.lines, defaultLineRows(config.type)).map((line, index) => (
                <div
                  key={line.id}
                  className={`grid h-8 grid-cols-[3.25rem_4.5rem_minmax(0,1fr)_5.75rem_4.75rem_6.25rem] items-center px-2 text-[13px] text-[#3d4c5c] ${
                    index % 2 === 0 ? 'bg-white' : 'bg-[#E7F1F8]'
                  }`}
                >
                  <span className="tabular text-center">{line.blank ? '' : trimNumber(line.quantity)}</span>
                  <span className="truncate pr-2">{line.blank ? '' : (line.item?.sku ?? '')}</span>
                  <span className="truncate pr-3">{line.blank ? '' : (line.description ?? line.item?.name ?? '')}</span>
                  <span className="tabular text-right">{line.blank ? '' : money(line.unitPrice)}</span>
                  <span className="tabular text-right">
                    {line.blank || !line.discountPercent || Number(line.discountPercent) === 0
                      ? ''
                      : `${trimNumber(line.discountPercent)}%`}
                  </span>
                  <span className="tabular text-right font-medium text-[#1B3A4B]">
                    {line.blank ? '' : money(line.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <dl className="ml-auto mt-5 w-64 space-y-1.5 text-sm text-[#5C6B7A]">
            <div className="flex justify-between gap-6">
              <dt>Subtotal</dt>
              <dd className="tabular">{money(document.subtotal)}</dd>
            </div>
            {hasDiscount ? (
              <div className="flex justify-between gap-6">
                <dt>Discount</dt>
                <dd className="tabular">{money(document.discountAmount)}</dd>
              </div>
            ) : null}
            {hasTax ? (
              <div className="flex justify-between gap-6">
                <dt>Tax</dt>
                <dd className="tabular">{money(document.taxTotal)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-6 pt-2 text-base font-bold text-[#1B3A4B]">
              <dt className="uppercase tracking-[0.08em]">Total</dt>
              <dd className="tabular text-lg">{money(document.total)}</dd>
            </div>
            {hasPayment ? (
              <>
                <div className="flex justify-between gap-6 pt-1 font-normal text-[#5C6B7A]">
                  <dt>Paid</dt>
                  <dd className="tabular">{money(document.amountApplied)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-6 border-t border-[#d5dee8] pt-2 font-bold text-[#1B3A4B]">
                  <dt>Amount due</dt>
                  <dd className="tabular">{money(document.balance)}</dd>
                </div>
              </>
            ) : null}
          </dl>

          {document.customerMessage ? (
            <p className="mt-8 max-w-md text-sm leading-relaxed text-[#5C6B7A]">{document.customerMessage}</p>
          ) : null}

          {document.status === 'VOID' ? (
            <p className="mt-8 text-center text-lg font-semibold uppercase tracking-[0.28em] text-[#9f1239]">
              Void
            </p>
          ) : null}
        </div>
      </article>
    </div>
  )
}

function longDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(toDate(iso))
}

function trimNumber(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : value
}

function paddedLines<T extends { id: string }>(lines: T[], minimum: number) {
  const blanks = Array.from({ length: Math.max(0, minimum - lines.length) }, (_, index) => ({
    id: `blank-${index}`,
    blank: true as const,
  }))
  return [...lines.map((line) => ({ ...line, blank: false as const })), ...blanks]
}

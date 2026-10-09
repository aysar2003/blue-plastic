import { calendarDateInZone, toCalendarDate, toDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { printSheetLinePad, type SalesTypeConfig } from '@/lib/sales-types'
import { CUSTOMER_CREDIT, FORM_SHEET } from '@/lib/credit-brand'
import { SheetMarks } from '@/components/sales/sheet-marks'
import type { SalesDocumentDetail } from '@/server/services/sales.service'

/** What the sheet needs from the business: its name and letterhead lines. */
export type InvoiceSheetOrganization = {
  name: string
  legalName: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  country: string | null
  phone: string | null
  email: string | null
  taxRegistrationNumber: string | null
  timeZone?: string | null
}

/**
 * The customer-facing document, in the sales sheet style: the business name
 * at the top right, a navy line table, and the totals stacked beneath it.
 *
 * One component for every paper that shows an invoice whole — the single
 * invoice print page and the "invoice by invoice" statement — so the two can
 * never drift apart.
 */
export function InvoiceSheet({
  document,
  organization,
  config,
  baseCurrency,
  className,
}: {
  document: SalesDocumentDetail
  organization: InvoiceSheetOrganization
  config: SalesTypeConfig
  baseCurrency: string
  className?: string
}) {
  const currency = document.currencyCode || baseCurrency
  const customer = document.customer
  const money = (value: string | number) => formatMoney(value, currency)
  const hasDiscount = Number(document.discountAmount) > 0
  const hasTax = Number(document.taxTotal) > 0
  const hasPayment = config.type === 'INVOICE' && Number(document.amountApplied) > 0
  const isCredit = config.type === 'CREDIT_MEMO'
  const brand = isCredit ? CUSTOMER_CREDIT.accent : FORM_SHEET.accent
  const brandSoft = isCredit ? CUSTOMER_CREDIT.wash : FORM_SHEET.wash
  const marks = isCredit
    ? {
        markA: CUSTOMER_CREDIT.markA,
        markB: CUSTOMER_CREDIT.markB,
        markC: CUSTOMER_CREDIT.markC,
        markD: CUSTOMER_CREDIT.markD,
      }
    : undefined

  const seller = [
    [organization.addressLine1, organization.addressLine2].filter(Boolean).join(', '),
    [organization.city, organization.region, organization.postalCode].filter(Boolean).join(' '),
    organization.country,
  ].filter(Boolean)

  // The heading block is a <div>, not a <header>: the print stylesheet hides
  // every <header> (the app's top bar), which took the invoice number, the
  // business address and the INVOICE title off the printed sheet with it.
  return (
    <article className={`invoice-sheet relative min-h-[920px] overflow-hidden bg-white text-[#1f1f23] shadow-[0_12px_40px_rgb(15_23_42/0.08)] print:min-h-0 print:shadow-none ${className ?? ''}`}>
      <div className="px-8 py-4 text-white sm:px-12" style={{ background: brand }}>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/80">
          {isCredit ? 'Customer credit' : config.singular}
        </p>
        <h1 className="text-xl font-semibold tracking-wide sm:text-2xl">
          {organization.legalName ?? organization.name}
        </h1>
      </div>
      <SheetMarks colors={marks} />

      <div className="relative px-8 pb-24 pt-10 sm:px-12">
        <div className="flex justify-end">
          <div className="max-w-md text-right">
            <p className="text-sm font-semibold" style={{ color: brand }}>
              {document.number}
            </p>
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
            <p
              className="mt-8 text-xl font-bold uppercase tracking-[0.18em]"
              style={{ color: brand }}
            >
              {config.singular}
            </p>
            <p className="mt-1 text-lg font-semibold tracking-wide">{document.number}</p>
            {document.status === 'DRAFT' ? (
              <p
                className="mt-1 text-xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: isCredit ? CUSTOMER_CREDIT.ink : '#017e84' }}
              >
                Draft
              </p>
            ) : null}
          </div>
        </div>

        <dl className="mt-10 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="font-bold uppercase tracking-[0.12em]" style={{ color: brand }}>
            {isCredit ? 'Credit to' : 'Billed to'}
          </dt>
          <dd className="text-[#5C6B7A]">
            <span className="text-[#3d4c5c]">{customer.displayName}</span>
            {customer.billingLine1 ? <span className="mt-0.5 block">{customer.billingLine1}</span> : null}
            {customer.billingCity ? <span className="block">{customer.billingCity}</span> : null}
            {customer.email ? <span className="block">{customer.email}</span> : null}
          </dd>
          <dt className="font-bold uppercase tracking-[0.12em]" style={{ color: brand }}>
            Date
          </dt>
          <dd className="text-[#5C6B7A]">
            {longDate(toCalendarDate(document.date), document.createdAt, organization.timeZone)}
          </dd>
          {document.dueDate ? (
            <>
              <dt className="font-bold uppercase tracking-[0.12em]" style={{ color: brand }}>
                Due
              </dt>
              <dd className="text-[#5C6B7A]">{longDate(toCalendarDate(document.dueDate))}</dd>
            </>
          ) : null}
          {document.expiryDate && config.type === 'ESTIMATE' ? (
            <>
              <dt className="font-bold uppercase tracking-[0.12em]" style={{ color: brand }}>
                Valid until
              </dt>
              <dd className="text-[#5C6B7A]">{longDate(toCalendarDate(document.expiryDate))}</dd>
            </>
          ) : null}
          {document.reference ? (
            <>
              <dt className="font-bold uppercase tracking-[0.12em]" style={{ color: brand }}>
                Reference
              </dt>
              <dd className="text-[#5C6B7A]">{document.reference}</dd>
            </>
          ) : null}
        </dl>

        <div className="mt-8">
          <div
            className="grid grid-cols-[3.25rem_4.5rem_minmax(0,1fr)_5.75rem_4.75rem_6.25rem] px-2 py-2 text-[13px] font-medium text-white"
            style={{ background: brand }}
          >
            <span className="text-center">Qty</span>
            <span>Item #</span>
            <span>Description</span>
            <span className="text-right">Unit Price</span>
            <span className="text-right">Discount</span>
            <span className="text-right">Line Total</span>
          </div>
          <div>
            {paddedLines(document.lines, printSheetLinePad(config.type)).map((line, index) => (
              <div
                key={line.id}
                className="grid h-8 grid-cols-[3.25rem_4.5rem_minmax(0,1fr)_5.75rem_4.75rem_6.25rem] items-center px-2 text-[13px] text-[#3d4c5c]"
                style={{ background: index % 2 === 0 ? '#ffffff' : brandSoft }}
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
                <span className="tabular text-right font-medium" style={{ color: brand }}>
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
          <div
            className="flex items-baseline justify-between gap-6 pt-2 text-base font-bold"
            style={{ color: brand }}
          >
            <dt className="uppercase tracking-[0.08em]">Total</dt>
            <dd className="tabular text-lg">{money(document.total)}</dd>
          </div>
          {hasPayment ? (
            <>
              <div className="flex justify-between gap-6 pt-1 font-normal text-[#5C6B7A]">
                <dt>Paid</dt>
                <dd className="tabular">{money(document.amountApplied)}</dd>
              </div>
              <div
                className="flex items-baseline justify-between gap-6 border-t border-[#e0d5dc] pt-2 font-bold"
                style={{ color: brand }}
              >
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
  )
}

export function longDate(iso: string, instant?: Date | null, timeZone?: string | null): string {
  const zone = timeZone || 'UTC'
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(toDate(iso))
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) return day
  if (calendarDateInZone(instant, zone) !== iso) return day
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant)
  return `${day}, ${time}`
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

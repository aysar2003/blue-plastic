import { longDate, type SheetDocument } from '@/components/sales/invoice-sheet'
import { accentWash, type DocumentTemplate } from '@/lib/document-template'
import { letterheadOf, type LetterheadSource } from '@/lib/letterhead'
import { toCalendarDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { STATUS_LABELS } from '@/lib/sales-types'

const TITLES: Record<string, string> = {
  INVOICE: 'INVOICE',
  CREDIT_MEMO: 'CREDIT NOTE',
  ESTIMATE: 'ESTIMATE',
  QUOTATION: 'QUOTATION',
  SALES_RECEIPT: 'SALES RECEIPT',
  REFUND_RECEIPT: 'REFUND',
}

/**
 * The merchant bill from the DH1SE paper: company block, bill-to grid, line
 * table, bank lines, the customer's running balance, and the totals band.
 *
 * Settings → Templates owns the colour, the bank lines, and the terms.
 */
export function MerchantInvoice({
  document,
  organization,
  template,
  config,
  baseCurrency,
  previousBalance,
  currentBalance,
  printedBy,
  words,
}: {
  document: SheetDocument
  organization: LetterheadSource & { timeZone?: string | null; taxRegistrationNumber?: string | null }
  template: DocumentTemplate
  config: { type: string; singular: string }
  /** Words on the sheet. The invoice paper is the default; a vendor bill keeps the same colour and layout. */
  words?: {
    party: string
    account: string
    date: string
    person: string
    reference: string
    order: string
  }
  baseCurrency: string
  /** Account balance before this paper. Omitted on a single invoice. */
  previousBalance?: string | null
  /** Account balance after this paper. Falls back to the document balance. */
  currentBalance?: string | null
  printedBy?: string | null
}) {
  const label = words ?? {
    party: 'Bill to',
    account: 'Customer account',
    date: 'Invoice date',
    person: 'Sales person',
    reference: 'Cust P.O no',
    order: 'Sales order',
  }
  const accent = template.accent
  const wash = accentWash(accent)
  const company = letterheadOf(organization)
  const currency = document.currencyCode || baseCurrency
  const money = (value: string | number) => formatMoney(value, currency)
  const customer = document.customer
  const address = [customer.billingLine1, customer.billingLine2, customer.billingCity, customer.billingRegion]
    .filter(Boolean)
    .join(', ')
  const owed = Number(document.balance) > 0.004
  const status =
    document.status === 'PAID' ? 'PAID' : owed || document.status === 'OPEN' || document.status === 'PARTIAL' ? 'UNPAID' : (STATUS_LABELS[document.status] ?? document.status).toUpperCase()
  const statusColor = status === 'PAID' ? '#047857' : status === 'UNPAID' ? '#be123c' : accent
  const printedOn = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())

  return (
    <article className="merchant-invoice relative overflow-hidden bg-white text-[13px] text-[#1f2933] shadow-[0_12px_40px_rgb(15_23_42/0.08)] print:shadow-none">
      <div className="flex items-start justify-between gap-6 px-8 pb-4 pt-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: accent }}>
            {company.name}
          </h1>
        </div>
        <div className="text-right text-[11px] leading-5 text-[#3d4c5c]">
          {company.phone ? <p>TEL: {company.phone}</p> : null}
          {company.email ? <p>EMAIL: {company.email}</p> : null}
          {company.address ? <p>ADDR: {company.address}</p> : null}
        </div>
      </div>

      <div className="grid gap-6 px-8 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
            {label.party}
          </p>
          <p className="mt-1 text-sm font-semibold">{customer.displayName}</p>
          <dl className="mt-3 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-y-1 text-[12px]">
            <Meta label={label.reference} value={document.reference || '—'} />
            <Meta label="Due date" value={document.dueDate ? longDate(toCalendarDate(document.dueDate)) : '—'} />
            <Meta label="Payment" value={document.paymentTerm?.name || '—'} />
            <Meta label="Address" value={address || '—'} />
            <Meta label="Phone" value={customer.phone || '—'} />
            <Meta label={label.order} value={document.reference || '—'} />
            <Meta label={label.person} value={document.createdByName || '—'} />
          </dl>
        </div>
        <div className="text-right">
          <p className="text-lg font-black tracking-wide" style={{ color: accent }}>
            {TITLES[config.type] ?? config.singular.toUpperCase()}
          </p>
          <p className="mt-1 font-semibold">{document.number}</p>
          <p className="mt-2 inline-block rounded px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: statusColor }}>
            {status}
          </p>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: accent }}>
            {label.date}
          </p>
          <p>{longDate(toCalendarDate(document.date), document.createdAt, organization.timeZone)}</p>
        </div>
      </div>

      <div className="mx-8 mt-6">
        <div
          className="grid grid-cols-[2rem_minmax(0,1fr)_5.5rem_5.5rem_6rem] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white"
          style={{ background: accent }}
        >
          <span>No</span>
          <span>Item name</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Rate</span>
          <span className="text-right">Amount</span>
        </div>
        {document.lines.map((line, index) => (
          <div
            key={line.id}
            className="grid grid-cols-[2rem_minmax(0,1fr)_5.5rem_5.5rem_6rem] items-center px-2 py-1.5 text-[12px]"
            style={{ background: index % 2 === 0 ? '#ffffff' : wash }}
          >
            <span className="tabular">{line.lineNumber}</span>
            <span className="truncate pr-2">{line.description || line.item?.name || line.item?.sku || ''}</span>
            <span className="tabular text-right">
              {trimNumber(line.quantity)} {line.item?.unitOfMeasure || 'Pcs'}
            </span>
            <span className="tabular text-right">{money(line.unitPrice)}</span>
            <span className="tabular text-right font-medium">{money(line.amount)}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 px-8 py-6 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-4 text-[12px]">
          {template.banks.length > 0 ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
                Bank details
              </p>
              <dl className="mt-1 space-y-0.5">
                {template.banks.map((bank) => (
                  <div key={`${bank.name}-${bank.account}`} className="flex justify-between gap-4">
                    <dt>{bank.name}</dt>
                    <dd className="tabular">{bank.account}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
              {label.account}
            </p>
            <dl className="mt-1 space-y-0.5">
              <div className="flex justify-between gap-4">
                <dt>Previous balance</dt>
                <dd className="tabular">{previousBalance ? money(previousBalance) : '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Current balance</dt>
                <dd className="tabular">{money(currentBalance ?? document.balance)}</dd>
              </div>
            </dl>
          </div>
          {template.terms ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
                Terms & conditions
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[#3d4c5c]">{template.terms}</p>
            </div>
          ) : null}
        </div>

        <dl className="space-y-1 text-[12px]">
          <Total label="Subtotal" value={money(document.subtotal)} accent={accent} />
          {Number(document.discountAmount) > 0 ? (
            <Total label="Discount" value={money(document.discountAmount)} accent={accent} />
          ) : null}
          {Number(document.taxTotal) > 0 ? <Total label="Tax" value={money(document.taxTotal)} accent={accent} /> : null}
          <Total label="Grand total" value={money(document.total)} accent={accent} strong />
          <Total label="Paid amount" value={money(document.amountApplied)} accent={accent} />
          <Total label="Balance" value={money(document.balance)} accent={accent} strong />
        </dl>
      </div>

      <div className="flex justify-between gap-4 border-t px-8 py-3 text-[10px] text-[#5C6B7A]">
        <p>Printed on: {printedOn}</p>
        <p>{printedBy ? `Printed by: ${printedBy}` : null}</p>
      </div>
    </article>
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

function Total({
  label,
  value,
  accent,
  strong,
}: {
  label: string
  value: string
  accent: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1 text-white" style={{ background: accent }}>
      <dt className={strong ? 'font-bold uppercase' : 'uppercase'}>{label}</dt>
      <dd className={`tabular ${strong ? 'font-bold' : ''}`}>{value}</dd>
    </div>
  )
}

function trimNumber(value: string): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return n.toFixed(2)
}

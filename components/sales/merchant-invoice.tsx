'use client'

import { useMemo, useSyncExternalStore } from 'react'

import { TableColumnCustomize } from '@/components/data/table-column-customize'
import { DocumentAccountFooter } from '@/components/sales/document-account-footer'
import { DocumentBarcode } from '@/components/print/document-barcode'
import { longDate, type SheetDocument } from '@/components/sales/invoice-sheet'
import { accentWash, paperAccent, type DocumentTemplate } from '@/lib/document-template'
import { orgLogoUrl } from '@/lib/org-brand'
import { letterheadOf, type LetterheadSource } from '@/lib/letterhead'
import { toCalendarDate } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import {
  PAPER_META_STORAGE_KEY,
  type PaperMetaFieldId,
} from '@/lib/paper-meta-fields'
import { hasPreviousQuotations } from '@/lib/project-quotations'
import {
  isProposal,
  paperDateLabel,
  paperShowsMoneyStatus,
  STATUS_LABELS,
} from '@/lib/sales-types'
import { useTableColumnPrefs } from '@/lib/use-table-column-prefs'

/** Cached so getSnapshot stays referentially stable (React forbids a fresh value each read). */
let clientNowLabel: string | null = null

function readClientNowLabel() {
  if (clientNowLabel == null) {
    clientNowLabel = new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())
  }
  return clientNowLabel
}

function useClientNowLabel() {
  return useSyncExternalStore(
    () => () => {},
    readClientNowLabel,
    () => '',
  )
}

const TITLES: Record<string, string> = {
  INVOICE: 'INVOICE',
  CREDIT_MEMO: 'CREDIT NOTE',
  ESTIMATE: 'ESTIMATE',
  QUOTATION: 'QUOTATION',
  SALES_ORDER: 'SALES ORDER',
  SALES_RECEIPT: 'SALES RECEIPT',
  REFUND_RECEIPT: 'REFUND',
  BILL: 'BILL',
  EXPENSE: 'EXPENSE',
  VENDOR_CREDIT: 'VENDOR CREDIT',
  PURCHASE_ORDER: 'PURCHASE ORDER',
  PURCHASE_REQUEST: 'PURCHASE REQUEST',
  RFQ: 'RFQ',
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
  previousQuotationsTotal,
  hideAccountBalance = false,
  printedBy,
  words,
  ledger = false,
  approval = null,
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
  /** Who approved the document, when the books recorded an approval. */
  approval?: { name: string; at: Date | null } | null
  /** Account balance before this paper. Omitted on a single invoice. */
  previousBalance?: string | null
  /** Account balance after this paper. Falls back to the document balance. */
  currentBalance?: string | null
  /** Sum of earlier project quotations. The grand total then includes this paper. */
  previousQuotationsTotal?: string | null
  /** Project quotation pack: no customer A/R or leftover balance — only the running quote total. */
  hideAccountBalance?: boolean
  printedBy?: string | null
  /** Statement / portal: Debit = invoice total, Credit = payments, Balance = remaining. */
  ledger?: boolean
}) {
  const label = words ?? {
    party: 'Bill to',
    account: 'Customer account',
    date: paperDateLabel(config.type),
    person: 'Sales person',
    reference: 'Cust P.O no',
    order: 'Sales order',
  }
  const accent = paperAccent(template, words?.party === 'Vendor' ? 'vendor' : 'customer')
  const wash = accentWash(accent)
  const company = letterheadOf(organization)
  const currency = document.currencyCode || baseCurrency
  const money = (value: Parameters<typeof formatMoney>[0]) => formatMoney(value, currency)
  const customer = document.customer
  const address = [customer.billingLine1, customer.billingLine2, customer.billingCity, customer.billingRegion]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.trim())
    .filter((part) => part.toLowerCase() !== customer.displayName.trim().toLowerCase())
    .join(', ')
  const owed = Number(document.balance) > 0.004
  const moneyStatus = paperShowsMoneyStatus(config.type)
  const status = moneyStatus
    ? document.status === 'PAID'
      ? 'PAID'
      : owed || document.status === 'OPEN' || document.status === 'PARTIAL'
        ? 'UNPAID'
        : (STATUS_LABELS[document.status] ?? document.status).toUpperCase()
    : (STATUS_LABELS[document.status] ?? document.status).toUpperCase()
  const statusColor =
    moneyStatus && status === 'PAID'
      ? '#047857'
      : moneyStatus && status === 'UNPAID'
        ? '#be123c'
        : accent
  const proposal = isProposal(config.type)
  const printedOn = useClientNowLabel()

  const metaCatalog = useMemo(
    () => [
      { id: 'reference' as const, label: label.reference },
      { id: 'dueDate' as const, label: 'Due date' },
      { id: 'payment' as const, label: 'Payment' },
      { id: 'address' as const, label: 'Address' },
      { id: 'phone' as const, label: 'Phone' },
      { id: 'order' as const, label: label.order },
      { id: 'person' as const, label: label.person },
      { id: 'workSite' as const, label: 'Work site' },
      { id: 'workScope' as const, label: 'Work / job' },
      { id: 'email' as const, label: 'Email' },
      { id: 'printedFooter' as const, label: 'Printed on / by' },
    ],
    [label.order, label.person, label.reference],
  )
  const { prefs, toggle, reorder } = useTableColumnPrefs(PAPER_META_STORAGE_KEY, metaCatalog)

  const metaRows = useMemo(() => {
    const workSite = document.workSite || document.project?.siteLocation || ''
    const available: { id: PaperMetaFieldId; label: string; value: string }[] = []
    if (document.reference) {
      available.push({ id: 'reference', label: label.reference, value: document.reference })
    }
    if (!proposal && document.dueDate) {
      available.push({
        id: 'dueDate',
        label: 'Due date',
        value: longDate(toCalendarDate(document.dueDate)),
      })
    }
    if (!proposal && document.paymentTerm?.name) {
      available.push({ id: 'payment', label: 'Payment', value: document.paymentTerm.name })
    }
    if (address) available.push({ id: 'address', label: 'Address', value: address })
    if (customer.phone) available.push({ id: 'phone', label: 'Phone', value: customer.phone })
    if (!proposal && document.reference) {
      available.push({ id: 'order', label: label.order, value: document.reference })
    }
    if (document.createdByName) {
      available.push({ id: 'person', label: label.person, value: document.createdByName })
    }
    if (workSite) available.push({ id: 'workSite', label: 'Work site', value: workSite })
    if (document.workScope) {
      available.push({
        id: 'workScope',
        label: 'Work / job',
        value: `${document.workScope} · Client: ${customer.displayName}`,
      })
    }
    if (customer.email) available.push({ id: 'email', label: 'Email', value: customer.email })

    const byId = new Map(available.map((row) => [row.id, row]))
    return prefs.order
      .filter((id) => !prefs.hidden.includes(id))
      .map((id) => byId.get(id as PaperMetaFieldId))
      .filter((row): row is { id: PaperMetaFieldId; label: string; value: string } => Boolean(row))
  }, [
    address,
    customer.displayName,
    customer.email,
    customer.phone,
    document.createdByName,
    document.dueDate,
    document.paymentTerm,
    document.project?.siteLocation,
    document.reference,
    document.workScope,
    document.workSite,
    label.order,
    label.person,
    label.reference,
    prefs.hidden,
    prefs.order,
    proposal,
  ])

  // Account running figure: Previous + Debit − Credit (payment / customer credit).
  const prior = previousBalance != null && previousBalance !== '' ? new Decimal(previousBalance) : ZERO
  const debit = new Decimal(document.total)
  const credit = new Decimal(document.amountApplied || 0)
  const accountBalance = prior.plus(debit).minus(credit)
  const priorQuotes = hasPreviousQuotations(previousQuotationsTotal)
  const runningQuoteTotal = priorQuotes
    ? new Decimal(previousQuotationsTotal as string).plus(document.total)
    : debit

  if (template.paperStyle === 'trade') {
    return (
      <TradePaper
        document={document}
        company={company}
        label={label}
        money={money}
        address={address}
        config={config}
        terms={template.terms}
        statusColor={statusColor}
        customerMessage={document.customerMessage}
        previousQuotationsTotal={priorQuotes ? (previousQuotationsTotal as string) : null}
        thisQuotationTotal={priorQuotes ? document.total : null}
        runningQuoteTotal={priorQuotes ? runningQuoteTotal.toFixed(4) : null}
        person={document.createdByName ?? ''}
        dateLabel={longDate(toCalendarDate(document.date), document.createdAt, organization.timeZone)}
        approval={approval}
        website={(organization as { website?: string | null }).website ?? null}
        legalName={organization.legalName ?? null}
        logoSrc={orgLogoUrl(
          Boolean((organization as { logoStorageKey?: string | null }).logoStorageKey),
          (organization as { updatedAt?: Date | null }).updatedAt,
        )}
        accent={accent}
      />
    )
  }

  return (
    <article
      className="merchant-invoice relative overflow-hidden bg-white text-[13px] text-[#1f2933] shadow-[0_12px_40px_rgb(15_23_42/0.08)] print:overflow-visible print:shadow-none"
      style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      <div className="mb-2 flex justify-end px-8 print:hidden">
        <TableColumnCustomize
          columns={metaCatalog}
          prefs={prefs}
          onToggle={toggle}
          onReorder={reorder}
          title="Paper details"
          description="Show or hide Bill to lines and the Printed on / by footer. Drag to change order."
          showAllLabel="Show all details"
        />
      </div>
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
            {metaRows.map((row) => (
              <Meta key={row.id} label={row.label} value={row.value} />
            ))}
          </dl>
        </div>
        <div className="text-right">
          <p className="text-lg font-black tracking-wide" style={{ color: accent }}>
            {TITLES[config.type] ?? config.singular.toUpperCase()}
          </p>
          <p className="mt-1 font-semibold">{document.number}</p>
          <div className="mt-2 flex justify-end">
            <DocumentBarcode value={document.number} height={40} moduleWidth={1.15} />
          </div>
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
          className={
            proposal
              ? 'grid grid-cols-[2rem_minmax(0,1fr)_6.5rem_5rem_5.4rem] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white'
              : 'grid grid-cols-[2rem_minmax(0,1fr)_4.2rem_3.4rem_5rem_5.4rem] px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white'
          }
          style={{ background: accent }}
        >
          <span>No</span>
          <span>Item name</span>
          <span className="text-right">Qty</span>
          {proposal ? null : <span className="text-right">Unit</span>}
          <span className="text-right">Rate</span>
          <span className="text-right">Amount</span>
        </div>
        {document.lines.map((line, index) => {
          const unit = line.item?.unitOfMeasure?.trim() || 'EACH'
          const qty = proposal ? `${trimNumber(line.quantity)} ${unit}` : trimNumber(line.quantity)
          return (
          <div
            key={line.id}
            className={
              proposal
                ? 'grid grid-cols-[2rem_minmax(0,1fr)_6.5rem_5rem_5.4rem] items-center px-2 py-1.5 text-[12px]'
                : 'grid grid-cols-[2rem_minmax(0,1fr)_4.2rem_3.4rem_5rem_5.4rem] items-center px-2 py-1.5 text-[12px]'
            }
            style={{ background: index % 2 === 0 ? '#ffffff' : wash }}
          >
            <span className="tabular">{line.lineNumber}</span>
            <span className="truncate pr-2">{line.description || line.item?.name || line.item?.sku || ''}</span>
            <span className="tabular text-right">{qty}</span>
            {proposal ? null : (
              <span className="text-right">{(line.item?.unitOfMeasure?.trim() || 'EACH').toUpperCase()}</span>
            )}
            <span className="tabular text-right">{money(line.unitPrice)}</span>
            <span className="tabular text-right font-medium">{money(line.amount)}</span>
          </div>
          )
        })}
      </div>

      {/* Keep subtotal → grand total on one sheet; do not orphan the last total. */}
      <div className="grid break-inside-avoid gap-6 px-8 py-6 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-4 text-[12px]">
          {template.footerLayout === 'side' ? (
            <DocumentAccountFooter template={template} accent={accent} />
          ) : null}
          {hideAccountBalance ? null : (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
              {label.account}
            </p>
            {ledger ? (
              <>
                <dl className="mt-1 space-y-0.5">
                  <div className="flex justify-between gap-4">
                    <dt>Previous balance</dt>
                    <dd className="tabular">{money(prior)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Debit (invoice)</dt>
                    <dd className="tabular">{money(debit)}</dd>
                  </div>
                  {credit.greaterThan('0.004') ? (
                    <div className="flex justify-between gap-4">
                      <dt>Credit (payment)</dt>
                      <dd className="tabular">{money(credit)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4 border-t border-[#d1d5db] pt-1 font-semibold">
                    <dt>Balance</dt>
                    <dd className="tabular">{money(accountBalance)}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] leading-snug text-[#5C6B7A]">
                  Previous = Balance from the invoice before this one. Balance =
                  Previous + Debit − Credit
                  {credit.greaterThan('0.004') ? '.' : ' (no credit on this invoice).'}
                </p>
              </>
            ) : (
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
            )}
          </div>
          )}
          {template.terms ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
                Terms & conditions
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[#3d4c5c]">{template.terms}</p>
            </div>
          ) : null}
        </div>

        <dl className="space-y-1 break-inside-avoid text-[12px]">
          <Total label="Subtotal" value={money(document.subtotal)} accent={accent} />
          {Number(document.discountAmount) > 0 ? (
            <Total label="Discount" value={money(document.discountAmount)} accent={accent} />
          ) : null}
          {Number(document.taxTotal) > 0 ? <Total label="Tax" value={money(document.taxTotal)} accent={accent} /> : null}
          {ledger ? (
            <>
              <Total label="Debit (invoice)" value={money(debit)} accent={accent} strong />
              {credit.greaterThan('0.004') ? (
                <Total label="Credit (payment)" value={money(credit)} accent={accent} />
              ) : null}
              <Total label="Balance" value={money(accountBalance)} accent={accent} strong />
            </>
          ) : (
            <>
              {priorQuotes ? (
                <>
                  <Total label="This quotation" value={money(document.total)} accent={accent} />
                  <Total
                    label="Previous quotations"
                    value={money(previousQuotationsTotal as string)}
                    accent={accent}
                  />
                  <Total label="Grand total" value={money(runningQuoteTotal)} accent={accent} strong />
                </>
              ) : (
                <Total label="Grand total" value={money(document.total)} accent={accent} strong />
              )}
              {hideAccountBalance ? null : (
                <>
                  {credit.greaterThan('0.004') ? (
                    <Total label="Paid amount" value={money(document.amountApplied)} accent={accent} />
                  ) : null}
                  <Total label="Balance" value={money(document.balance)} accent={accent} strong />
                </>
              )}
            </>
          )}
        </dl>
      </div>

      {template.footerLayout !== 'side' ? (
        <DocumentAccountFooter template={template} accent={accent} />
      ) : null}

      {proposal ? null : (
        <div className="px-8 pb-2 pt-4">
          <DocumentStampBlock
            createdBy={document.createdByName}
            approval={approval}
            status={STATUS_LABELS[document.status] ?? document.status}
          />
        </div>
      )}

      {prefs.hidden.includes('printedFooter') ? null : (
        <div className="flex justify-between gap-4 border-t px-8 py-3 text-[10px] text-[#5C6B7A]">
          <p>Printed on: {printedOn}</p>
          <p>{printedBy ? `Printed by: ${printedBy}` : null}</p>
        </div>
      )}
    </article>
  )
}

function DocumentStampBlock({
  createdBy,
  approval,
  status,
}: {
  createdBy?: string | null
  approval: { name: string; at: Date | null } | null
  status: string
}) {
  const approvedDate = approval?.at ? toCalendarDate(approval.at) : '—'
  return (
    <dl className="space-y-1 text-[11px]">
      <div className="flex gap-3">
        <dt className="w-32 shrink-0 whitespace-nowrap text-[#5C6B7A]">Created By:</dt>
        <dd>{createdBy?.trim() || '—'}</dd>
      </div>
      <div className="flex gap-3">
        <dt className="w-32 shrink-0 whitespace-nowrap text-[#5C6B7A]">Approved By:</dt>
        <dd>{approval?.name?.trim() || '—'}</dd>
      </div>
      <div className="flex gap-3">
        <dt className="w-32 shrink-0 whitespace-nowrap text-[#5C6B7A]">Approved Date:</dt>
        <dd>{approvedDate}</dd>
      </div>
      <div className="flex gap-3">
        <dt className="w-32 shrink-0 whitespace-nowrap text-[#5C6B7A]">Status:</dt>
        <dd className="capitalize">{status.replaceAll('_', ' ')}</dd>
      </div>
    </dl>
  )
}

function TradePaper({
  document,
  company,
  label,
  money,
  address,
  config,
  terms,
  customerMessage,
  previousQuotationsTotal,
  thisQuotationTotal,
  runningQuoteTotal,
  person,
  dateLabel,
  approval,
  website,
  legalName,
  logoSrc,
  accent,
  statusColor,
}: {
  document: SheetDocument
  company: { name: string; phone?: string | null; email?: string | null; address?: string | null }
  label: { party: string; date: string }
  money: (value: Parameters<typeof formatMoney>[0]) => string
  address: string
  config: { type: string; singular: string }
  terms: string
  customerMessage: string | null
  previousQuotationsTotal: string | null
  thisQuotationTotal: string | null
  runningQuoteTotal: string | null
  person: string
  dateLabel: string
  approval: { name: string; at: Date | null } | null
  website: string | null
  legalName: string | null
  logoSrc: string | null
  accent: string
  statusColor: string
}) {
  const purchase = label.party === 'Vendor'
  const title = `${TITLES[config.type] ?? config.singular.toUpperCase()} #${document.number}`
  const needed = dateLabel
  const status = (STATUS_LABELS[document.status] ?? document.status).replaceAll('_', ' ')
  const cols = 'grid grid-cols-[minmax(0,1.35fr)_2.75rem_5.4rem_4.4rem_3.2rem_4.4rem_5.4rem] gap-x-2'

  return (
    <article
      className="merchant-invoice bg-white px-10 pb-6 pt-8 text-[12px] leading-snug text-[#374151] shadow-[0_12px_40px_rgb(15_23_42/0.08)] print:shadow-none"
      style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      {/* A div, not a header: print CSS hides every header (the app bar), which dropped the company name and TEL / EMAIL / ADDR off the invoice PDF. */}
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
            {label.party}
          </p>
          <p className="mt-1 text-sm font-semibold">{document.customer.displayName}</p>
          <dl className="mt-3 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-y-1 text-[12px]">
            {address ? <Meta label="Address" value={address} /> : null}
            {document.customer.phone ? <Meta label="Phone" value={document.customer.phone} /> : null}
          </dl>
        </div>
        <div className="text-right">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="" className="mb-2 ml-auto h-12 w-14 object-contain" />
          ) : null}
          <p className="text-lg font-black tracking-wide" style={{ color: accent }}>
            {TITLES[config.type] ?? config.singular.toUpperCase()}
          </p>
          <p className="mt-1 font-semibold">{document.number}</p>
          <div className="mt-2 flex justify-end">
            <DocumentBarcode value={document.number} height={40} moduleWidth={1.15} />
          </div>
          <p className="mt-2 inline-block rounded px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: statusColor }}>
            {status.toUpperCase()}
          </p>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: accent }}>
            {label.date}
          </p>
          <p>{dateLabel}</p>
        </div>
      </div>

      <h2 className="mt-6 text-[22px] font-normal tracking-tight text-[#111827]">{title}</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="font-semibold text-[#111827]">{purchase ? 'Purchase Representative:' : 'Sales person:'}</p>
          <p className="mt-1">{person || '—'}</p>
        </div>
        <div>
          <p className="font-semibold text-[#111827]">{purchase ? 'Your Order Reference:' : 'Reference:'}</p>
          <p className="mt-1">{document.reference?.trim() || '—'}</p>
        </div>
        <div>
          <p className="font-semibold text-[#111827]">Order Date:</p>
          <p className="mt-1">{dateLabel}</p>
        </div>
      </div>

      {document.workSite || document.project?.siteLocation || document.workScope ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-[#111827]">Work site:</p>
            <p className="mt-1">{document.workSite || document.project?.siteLocation || '—'}</p>
          </div>
          <div>
            <p className="font-semibold text-[#111827]">Work / job:</p>
            <p className="mt-1">
              {document.workScope
                ? `${document.workScope} · Client: ${document.customer.displayName}`
                : '—'}
            </p>
          </div>
        </div>
      ) : null}

      <p className="mt-4">
        <span className="font-semibold">Remarks:</span>
        <span className="whitespace-pre-wrap">{customerMessage?.trim() || terms.trim() || '—'}</span>
      </p>

      <div className="mt-4">
        <div className={`${cols} border-b border-[#9ca3af] py-1 text-[12px] font-semibold text-[#111827]`}>
          <span>Description</span>
          <span className="text-right">Taxes</span>
          <span className="text-right">Date req.</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit</span>
          <span className="text-right">Unit price</span>
          <span className="text-right">Amount</span>
        </div>
        {document.lines.map((line, index) => {
          const unit = line.item?.unitOfMeasure?.trim() || 'EACH'
          return (
            <div
              key={line.id}
              className={`${cols} items-start py-1.5`}
              style={{ background: index % 2 === 0 ? '#ffffff' : '#f3f4f6' }}
            >
              <span className="pr-2">{line.description || line.item?.name || line.item?.sku || ''}</span>
              <span className="tabular text-right">
                {line.taxAmount && Number(line.taxAmount) > 0 ? money(line.taxAmount) : ''}
              </span>
              <span className="tabular text-right text-[11px]">{needed}</span>
              <span className="tabular text-right">
                {Number.isFinite(Number(line.quantity)) ? Number(line.quantity).toFixed(3) : line.quantity}
              </span>
              <span className="text-right">{unit.toUpperCase()}</span>
              <span className="tabular text-right">
                {Number.isFinite(Number(line.unitPrice)) ? Number(line.unitPrice).toFixed(3) : line.unitPrice}
              </span>
              <span className="tabular text-right">{money(line.amount)}</span>
            </div>
          )
        })}
      </div>

      <div className="grid break-inside-avoid gap-6 py-6 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <DocumentStampBlock
          createdBy={person}
          approval={approval}
          status={status}
        />
        <dl className="space-y-1 text-[12px]">
          <div className="flex justify-between gap-3">
            <dt>Subtotal</dt>
            <dd className="tabular">{money(document.subtotal)}</dd>
          </div>
          {config.type === 'PURCHASE_ORDER' ? (
            <div className="flex justify-between gap-3">
              <dt>Bill payment</dt>
              <dd className="tabular">{money(document.amountApplied || 0)}</dd>
            </div>
          ) : purchase ? (
            <div className="flex justify-between gap-3">
              <dt>Taxes</dt>
              <dd className="tabular">{money(document.taxTotal)}</dd>
            </div>
          ) : runningQuoteTotal ? null : (
            <div className="flex justify-between gap-3">
              <dt>Payment</dt>
              <dd className="tabular">{money(document.amountApplied || 0)}</dd>
            </div>
          )}
          {runningQuoteTotal ? (
            <>
              <div className="flex justify-between gap-3">
                <dt>This quotation</dt>
                <dd className="tabular">{money(thisQuotationTotal ?? document.total)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Previous quotations</dt>
                <dd className="tabular">{money(previousQuotationsTotal ?? '0')}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-[#1f2933] pt-1 font-semibold">
                <dt>Grand total</dt>
                <dd className="tabular">{money(runningQuoteTotal)}</dd>
              </div>
            </>
          ) : (
            <div className="flex justify-between gap-3 border-t border-[#1f2933] pt-1 font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{money(document.total)}</dd>
            </div>
          )}
        </dl>
      </div>

      <footer className="mt-2 border-t border-[#d1d5db] pt-2 text-center text-[10px] text-[#6b7280]">
        <p>{[company.email, website].filter(Boolean).join('  |  ')}</p>
        <p className="mt-1">Page 1 of 1</p>
      </footer>
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
    <div
      className="flex items-center justify-between gap-3 px-2 py-1 text-white"
      style={{ background: accent, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
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

import type { PurchaseDocumentType, SalesDocumentType } from '@prisma/client'
import Link from 'next/link'

import { InvoiceSheet, longDate, type InvoiceSheetOrganization, type SheetDocument } from '@/components/sales/invoice-sheet'
import { MerchantInvoice } from '@/components/sales/merchant-invoice'
import { SheetMarks } from '@/components/sales/sheet-marks'
import { FORM_SHEET } from '@/lib/credit-brand'
import { type DocumentTemplate } from '@/lib/document-template'
import { toCalendarDate, type CalendarDate } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { purchaseByType } from '@/lib/purchase-types'
import { byType } from '@/lib/sales-types'

/**
 * The two invoice papers, kept apart on purpose.
 *
 * "summary" is only the list: date, number, due, debit, credit, balance.
 * "invoices" is each invoice whole, on the same sheet as the single-invoice
 * PDF, one per page. Print → Save as PDF gives one file of whichever paper
 * is on screen.
 */
export function StatementInvoices({
  organization,
  baseCurrency,
  customer,
  from,
  to,
  allDates,
  caption,
  documents,
  omitted,
  closing,
  opening,
  accountAt,
  part,
  paper = 'merchant',
  template,
  printedBy,
  subject = 'invoice',
}: {
  organization: InvoiceSheetOrganization
  baseCurrency: string
  customer: { displayName: string; companyName: string | null; email: string | null; address: string[] }
  from: CalendarDate
  to: CalendarDate
  allDates: boolean
  caption: string
  documents: SheetDocument[]
  /** Invoice papers, or the same sheets filled with a vendor's bills. */
  subject?: 'invoice' | 'bill'
  /** Invoices in the period beyond what one paper prints. */
  omitted: number
  closing: Decimal
  opening?: Decimal
  /**
   * Customer account at each invoice: previous is what they owed just before
   * it was cut, current is what they owed just after. Invoice 2's previous is
   * invoice 1's current, and each later page adds the ones before it.
   */
  accountAt?: Record<string, { previous: string; current: string }>
  /** Which of the two papers this is. They are never drawn together. */
  part: 'summary' | 'invoices'
  /** Merchant is the bill from Settings. Classic is the older sheet, hidden until turned on. */
  paper?: 'merchant' | 'classic'
  template?: DocumentTemplate
  printedBy?: string
}) {
  const brand = FORM_SHEET.accent
  const brandSoft = FORM_SHEET.wash
  const money = (value: Decimal | string) => formatMoney(value, baseCurrency)
  const totals = documents.reduce(
    (sum, document) => ({
      total: sum.total.plus(document.total),
      paid: sum.paid.plus(document.amountApplied),
      due: sum.due.plus(document.balance),
    }),
    { total: ZERO, paid: ZERO, due: ZERO },
  )
  const period = allDates ? 'All dates' : `${longDate(from)} – ${longDate(to)}`

  const noun =
    subject === 'bill'
      ? { one: 'bill', many: 'bills', title: 'Bills', summary: 'Bill summary', column: 'Bill', party: 'Vendor', paper: 'Bill by bill' }
      : { one: 'invoice', many: 'invoices', title: 'Invoices', summary: 'Invoice summary', column: 'Invoice', party: 'Billed to', paper: 'Invoice by invoice' }
  const count = `${documents.length} ${documents.length === 1 ? noun.one : noun.many}`
  const lead =
    documents.length === 0
      ? `No ${noun.many} in this period.`
      : part === 'summary'
        ? `${count} on this summary only. ${noun.paper} prints each one on its own page.`
        : `${count}, each on its own page. Print, or Save as PDF, for one file with all of them.`

  return (
    <div className="mx-auto max-w-3xl" data-statement-invoices data-statement-part={part}>
      <p className="mb-4 text-sm text-muted-foreground print:hidden">
        {lead}
        {omitted > 0 ? ` ${omitted} more in this period are not shown — choose a shorter period to print them.` : ''}
      </p>

      {part === 'summary' ? (
      <article className="invoice-sheet relative min-h-[920px] overflow-hidden bg-white text-[#1f1f23] shadow-[0_12px_40px_rgb(15_23_42/0.08)] print:min-h-0 print:shadow-none">
        <div className="px-8 py-4 text-white sm:px-12" style={{ background: brand }}>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/80">{noun.title}</p>
          <h1 className="text-xl font-semibold tracking-wide sm:text-2xl">
            {organization.legalName ?? organization.name}
          </h1>
        </div>
        <SheetMarks />

        <div className="relative px-8 pb-24 pt-10 sm:px-12">
          <div className="flex justify-end">
            <div className="max-w-md text-right">
              <p className="text-xl font-bold uppercase tracking-[0.18em]" style={{ color: brand }}>
                {noun.summary}
              </p>
              <p className="mt-1 text-sm text-[#5C6B7A]">{period}</p>
              {caption ? <p className="text-sm text-[#5C6B7A]">{caption}</p> : null}
            </div>
          </div>

          <dl className="mt-10 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="font-bold uppercase tracking-[0.12em]" style={{ color: brand }}>
              {noun.party}
            </dt>
            <dd className="text-[#5C6B7A]">
              <span className="text-[#3d4c5c]">{customer.displayName}</span>
              {customer.companyName && customer.companyName !== customer.displayName ? (
                <span className="mt-0.5 block">{customer.companyName}</span>
              ) : null}
              {customer.address.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              {customer.email ? <span className="block">{customer.email}</span> : null}
            </dd>
            <dt className="font-bold uppercase tracking-[0.12em]" style={{ color: brand }}>
              {noun.title}
            </dt>
            <dd className="text-[#5C6B7A]">{documents.length}</dd>
          </dl>

          <div className="mt-8">
            <div
              className="grid grid-cols-[6.5rem_minmax(0,1fr)_6.5rem_6.5rem_6.5rem_6.5rem] px-2 py-2 text-[13px] font-medium text-white"
              style={{ background: brand }}
            >
              <span>Date</span>
              <span>{noun.column}</span>
              <span>Due</span>
              <span className="text-right">Debit</span>
              <span className="text-right">Credit</span>
              <span className="text-right">Balance</span>
            </div>
            {documents.map((document, index) => (
              <div
                key={document.id}
                className="grid min-h-8 grid-cols-[6.5rem_minmax(0,1fr)_6.5rem_6.5rem_6.5rem_6.5rem] items-center px-2 py-1 text-[13px] text-[#3d4c5c]"
                style={{ background: index % 2 === 0 ? '#ffffff' : brandSoft }}
              >
                <span className="tabular">{shortDate(toCalendarDate(document.date))}</span>
                <span className="truncate pr-2">
                  <a href={`#invoice-${document.id}`} className="underline-offset-4 hover:underline print:no-underline">
                    {document.number}
                  </a>
                </span>
                <span className="tabular">{document.dueDate ? shortDate(toCalendarDate(document.dueDate)) : '—'}</span>
                <span className="tabular text-right">{money(document.total)}</span>
                <span className="tabular text-right">{money(document.amountApplied)}</span>
                <span className="tabular text-right font-medium" style={{ color: brand }}>
                  {money(document.balance)}
                </span>
              </div>
            ))}
            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_6.5rem_6.5rem_6.5rem_6.5rem] border-t-2 px-2 py-2 text-[13px] font-bold" style={{ borderColor: brand, color: brand }}>
              <span />
              <span>Total</span>
              <span />
              <span className="tabular text-right">{money(totals.total)}</span>
              <span className="tabular text-right">{money(totals.paid)}</span>
              <span className="tabular text-right">{money(totals.due)}</span>
            </div>
          </div>

          <dl className="ml-auto mt-6 w-72 space-y-1.5 text-sm text-[#5C6B7A]">
            <div className="flex items-baseline justify-between gap-6 border-t border-[#e0d5dc] pt-2 font-bold" style={{ color: brand }}>
              <dt>Account balance at {shortDate(to)}</dt>
              <dd className="tabular">{money(closing)}</dd>
            </div>
            <p className="text-xs">Everything owed on the account, including anything outside this period.</p>
          </dl>
        </div>
      </article>
      ) : null}

      {part === 'invoices'
        ? documents.map((document, index) => {
        const sale = subject === 'invoice' ? byType(document.type as SalesDocumentType) : null
        const purchase = subject === 'bill' ? purchaseByType(document.type as PurchaseDocumentType) : null
        const config = sale ?? { type: document.type, singular: purchase?.singular ?? 'Bill' }
        const href = sale
          ? `/sales/${sale.slug}/${document.id}`
          : `/purchases/${purchase?.slug ?? 'bills'}/${document.id}`
        return (
        <section
          key={document.id}
          id={`invoice-${document.id}`}
          className={index === 0 ? 'scroll-mt-20 print:mt-0' : 'mt-8 scroll-mt-20 break-before-page print:mt-0'}
          data-invoice-page
        >
          <p className="mb-2 text-right text-xs print:hidden">
            <Link href={href} className="text-muted-foreground underline-offset-4 hover:underline">
              Open {document.number}
            </Link>
          </p>
          {paper === 'classic' || !template ? (
            <InvoiceSheet
              document={document}
              organization={organization}
              config={config}
              baseCurrency={baseCurrency}
              ledger
            />
          ) : (
            <MerchantInvoice
              document={document}
              organization={organization}
              template={template}
              config={config}
              baseCurrency={baseCurrency}
              previousBalance={accountAt?.[document.id]?.previous ?? opening?.toString() ?? null}
              currentBalance={accountAt?.[document.id]?.current ?? closing.toString()}
              printedBy={printedBy}
              words={
                subject === 'bill'
                  ? {
                      party: 'Vendor',
                      account: 'Vendor account',
                      date: 'Bill date',
                      person: 'Entered by',
                      reference: 'Vendor ref',
                      order: 'Reference',
                    }
                  : undefined
              }
            />
          )}
        </section>
        )
      })
        : null}
    </div>
  )
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(`${iso}T00:00:00Z`),
  )
}

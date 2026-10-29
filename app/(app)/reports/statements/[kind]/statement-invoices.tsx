import type { PurchaseDocumentType, SalesDocumentType } from '@prisma/client'
import Link from 'next/link'

import { InvoiceSheet, longDate, type InvoiceSheetOrganization, type SheetDocument } from '@/components/sales/invoice-sheet'
import { MerchantInvoice } from '@/components/sales/merchant-invoice'
import { accentWash, DEFAULT_DOCUMENT_TEMPLATE, paperAccent, type DocumentTemplate } from '@/lib/document-template'
import { type CalendarDate } from '@/lib/date'
import { letterheadOf } from '@/lib/letterhead'
import { Decimal } from '@/lib/money'
import { printPackSectionClass } from '@/lib/print-pack'
import { purchaseByType } from '@/lib/purchase-types'
import { byType } from '@/lib/sales-types'

import { SummaryTable, type SummaryRow } from './summary-table'

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
  subject = 'invoice',
  documentHref,
  ledgerRows,
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
  /** Override the per-document open link (portal uses `/portal/invoices/:id`). */
  documentHref?: (document: SheetDocument) => string
  /**
   * Summary only. Every movement on the account — bill, payment, expense,
   * journal — so the running balance starts at the brought forward and misses nothing.
   */
  ledgerRows?: SummaryRow[]
}) {
  const company = letterheadOf(organization)
  const accent = paperAccent(
    template ?? DEFAULT_DOCUMENT_TEMPLATE,
    subject === 'bill' ? 'vendor' : 'customer',
  )
  const wash = accentWash(accent)
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
      <article className="invoice-sheet merchant-invoice relative overflow-hidden bg-white text-[13px] text-[#1f2933] shadow-[0_12px_40px_rgb(15_23_42/0.08)] print:shadow-none">
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
              {noun.party}
            </p>
            <p className="mt-1 text-sm font-semibold">{customer.displayName}</p>
            {customer.companyName && customer.companyName !== customer.displayName ? (
              <p className="text-[12px] text-[#3d4c5c]">{customer.companyName}</p>
            ) : null}
            {customer.address.map((line) => (
              <p key={line} className="text-[12px] text-[#3d4c5c]">{line}</p>
            ))}
            <p className="mt-3 text-[12px] leading-relaxed text-[#3d4c5c]">
              {noun.summary}. {period}. {count}. Debit adds the amount. Credit is what was paid, and it comes off the current balance.
            </p>
            {caption ? <p className="mt-2 text-[12px] text-[#5C6B7A]">{caption}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-lg font-black tracking-wide" style={{ color: accent }}>
              {noun.summary.toUpperCase()}
            </p>
            <p className="mt-1 text-[12px] text-[#3d4c5c]">{period}</p>
          </div>
        </div>
        <div className="px-8 pb-8">
          <SummaryTable
            rows={
              ledgerRows ??
              documents.map((document) => ({
                id: document.id,
                number: document.number,
                date: document.date.toISOString(),
                dueDate: document.dueDate ? document.dueDate.toISOString() : null,
                amount: document.total.toString(),
                debit: document.total.toString(),
                credit: document.amountApplied.toString(),
              }))
            }
            currency={baseCurrency}
            accent={accent}
            wash={wash}
            numberLabel={noun.column}
            closing={closing.toString()}
            opening={opening?.toString() ?? '0'}
            asOf={to}
          />
        </div>
      </article>
      ) : null}

      {part === 'invoices'
        ? documents.map((document, index) => {
        const sale = subject === 'invoice' ? byType(document.type as SalesDocumentType) : null
        const purchase = subject === 'bill' ? purchaseByType(document.type as PurchaseDocumentType) : null
        const config = sale ?? { type: document.type, singular: purchase?.singular ?? 'Bill' }
        const href =
          documentHref?.(document) ??
          (sale
            ? `/sales/${sale.slug}/${document.id}`
            : `/purchases/${purchase?.slug ?? 'bills'}/${document.id}`)
        return (
        <section
          key={document.id}
          id={`invoice-${document.id}`}
          className={printPackSectionClass(index, documents.length)}
          data-invoice-page
          data-print-paper
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
              ledger
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

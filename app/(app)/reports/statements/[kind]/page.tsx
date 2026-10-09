import type { JournalSourceType } from '@prisma/client'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { InteractiveGrid } from '@/components/data/interactive-grid'
import { PageHeader } from '@/components/data/page-header'
import { PrintButton } from '@/app/(app)/sales/[type]/[id]/print/print-button'
import { StatementFilters } from '@/components/reports/statement-filters'
import { StatementSend } from '@/components/reports/statement-send'
import { Card, CardContent } from '@/components/ui/card'
import {
  readStatementFilter,
  statementFilterCaption,
  statementInvoices,
  visibleEntries,
} from '@/lib/customer-statement'
import { readVendorFilter, vendorFilterCaption, vendorTypeOptions, visibleVendorEntries } from '@/lib/vendor-statement'
import { accountOptions } from '@/lib/account-options'
import { formatDate, formatTransactionDate, toCalendarDate } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { PERIOD_LABELS, type PeriodKey } from '@/lib/report-periods'
import { requireOrgContext } from '@/server/auth/context'
import { generalLedger } from '@/server/accounting/balances'
import { resolveSources, sourceFor } from '@/server/services/journal-sources'
import { db } from '@/server/db'
import * as payables from '@/server/services/payables.service'
import * as receivables from '@/server/services/receivables.service'
import * as accountService from '@/server/services/account.service'
import * as organizationService from '@/server/services/organization.service'
import * as salesService from '@/server/services/sales.service'
import { readSettings, type SearchParams } from '../../params'
import { ReportControls } from '../../report-controls'
import { CustomerStatement, statementEmailBody } from './customer-statement'
import { StatementInvoices } from './statement-invoices'
import { StatementPicker } from './statement-picker'

/**
 * Statements.
 *
 * Three kinds, one page, because they are the same document about three
 * different things: a party or an account, a period, an opening balance, every
 * movement in date order, a closing balance. Splitting them into three pages
 * would mean three places for the running balance to be computed differently.
 *
 *   **Customer** — what they owe, and what they were sent. This is the document
 *   posted or emailed when somebody asks "what do I owe you?".
 *   **Vendor** — the mirror: what the business owes them.
 *   **Account** — every posted line on one ledger account with a running
 *   balance. A bank statement, a rent account, a director's loan.
 *
 * Each line links to the document behind it, and the page prints as paper —
 * `@media print` strips the shell, which is also how a PDF is produced.
 */
const KINDS = ['customer', 'vendor', 'account'] as const
type Kind = (typeof KINDS)[number]

/**
 * The period a statement opens on when the link does not name one. A party's
 * statement starts on 1 January of this year (year to date): the usual "what
 * happened this year" paper, with everything earlier carried in as the balance
 * brought forward. "All dates" stays one choice away in the period menu.
 */
const DEFAULT_PERIOD: Record<Kind, PeriodKey> = {
  customer: 'year-to-date',
  vendor: 'year-to-date',
  account: 'this-fiscal-year',
}

/** One "invoice by invoice" paper prints at most this many invoices. */
const INVOICE_PAPER_LIMIT = 200

const TITLES: Record<Kind, string> = {
  customer: 'Customer statement',
  vendor: 'Vendor statement',
  account: 'Account statement',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string }>
}): Promise<Metadata> {
  const { kind } = await params
  return { title: TITLES[kind as Kind] ?? 'Statement' }
}

export function generateStaticParams() {
  return KINDS.map((kind) => ({ kind }))
}

export default async function StatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>
  searchParams: Promise<SearchParams>
}) {
  const { kind } = await params
  if (!KINDS.includes(kind as Kind)) notFound()

  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization, DEFAULT_PERIOD[kind as Kind])
  const currency = ctx.organization.baseCurrency

  const one = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? null

  /* --- Who the statement is about --------------------------------------- */

  const [customers, vendors, chart] = await Promise.all([
    kind === 'customer'
      ? db.customer.findMany({
          where: { orgId: ctx.orgId },
          select: {
            id: true,
            displayName: true,
            companyName: true,
            email: true,
            phone: true,
            billingLine1: true,
            billingLine2: true,
            billingCity: true,
            billingRegion: true,
            billingPostalCode: true,
          },
          orderBy: { displayName: 'asc' },
        })
      : [],
    kind === 'vendor'
      ? db.vendor.findMany({
          where: { orgId: ctx.orgId },
          select: {
            id: true,
            displayName: true,
            companyName: true,
            email: true,
            phone: true,
            billingLine1: true,
            billingLine2: true,
            billingCity: true,
            billingRegion: true,
            billingPostalCode: true,
          },
          orderBy: { displayName: 'asc' },
        })
      : [],
    kind === 'account' ? accountService.selectableAccounts(ctx, { withBalances: true }) : [],
  ])

  const subjectId =
    kind === 'customer'
      ? one(query.customerId)
      : kind === 'vendor'
        ? one(query.vendorId)
        : one(query.accountId)

  const picker =
    kind === 'customer' ? (
      <StatementPicker
        label="Customer"
        param="customerId"
        value={subjectId}
        options={customers.map((customer) => ({
          value: customer.id,
          label: customer.displayName,
          hint: customer.email ?? undefined,
        }))}
      />
    ) : kind === 'vendor' ? (
      <StatementPicker
        label="Vendor"
        param="vendorId"
        value={subjectId}
        options={vendors.map((vendor) => ({
          value: vendor.id,
          label: vendor.displayName,
          hint: vendor.email ?? undefined,
        }))}
      />
    ) : (
      <StatementPicker
        label="Account"
        param="accountId"
        value={subjectId}
        options={accountOptions(chart, { showBalance: true }).map((option) => ({
          value: option.id,
          label: option.label,
          hint: option.hint,
          group: option.group,
        }))}
      />
    )

  const customerFilter = kind === 'customer' ? readStatementFilter(query) : null
  const vendorFilter = kind === 'vendor' ? readVendorFilter(query) : null

  const controls = (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">{picker}</div>
      <div className="print:hidden">
        <ReportControls
          period={settings.period}
          from={settings.range.from}
          to={settings.range.to}
          asOf={settings.asOf}
          basis={settings.basis}
          comparison={settings.comparison}
          controls={{ mode: 'range' }}
        />
        {customerFilter ? (
          <StatementFilters
            view={customerFilter.view}
            type={customerFilter.type}
            status={customerFilter.status}
            totals={customerFilter.totals}
            defaultView="detail"
            invoiceView
          />
        ) : null}
        {vendorFilter ? (
          <StatementFilters
            view={vendorFilter.view}
            type={vendorFilter.type}
            status={vendorFilter.status}
            totals={vendorFilter.totals}
            typeOptions={vendorTypeOptions()}
          />
        ) : null}
      </div>
    </>
  )

  if (!subjectId) {
    return (
      <>
        <PageHeader
          title={TITLES[kind as Kind]}
          description="Choose who — or which account — the statement is for."
        />
        {controls}
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nothing chosen yet. A statement is always about somebody: pick one above and the period
            fills in underneath.
          </CardContent>
        </Card>
      </>
    )
  }

  /* --- The statement itself --------------------------------------------- */

  type Line = {
    id: string
    recordedAt: string
    number: string
    description: string
    charge: Decimal
    credit: Decimal
    balance: Decimal
    href: string
  }

  let subjectName = ''
  let opening = ZERO
  let closing = ZERO
  let lines: Line[] = []
  let chargeLabel = 'Charges'
  let creditLabel = 'Payments'

  if (kind === 'customer') {
    const customer = customers.find((row) => row.id === subjectId)
    if (!customer || !customerFilter) notFound()
    const statement = await receivables.statement(ctx, subjectId, settings.range)
    const entries = visibleEntries(statement.entries, customerFilter, settings.asOf)
    const charges = statement.entries.reduce((sum, entry) => sum.plus(entry.charge), ZERO)
    const credits = statement.entries.reduce((sum, entry) => sum.plus(entry.credit), ZERO)
    const address = [
      [customer.billingLine1, customer.billingLine2].filter(Boolean).join(', '),
      [customer.billingCity, customer.billingRegion, customer.billingPostalCode].filter(Boolean).join(' '),
    ].filter(Boolean)
    if (customerFilter.view === 'invoices') {
      const invoices = statementInvoices(statement.entries, customerFilter, settings.asOf)
      const [documents, organization] = await Promise.all([
        salesService.getMany(
          ctx,
          invoices.slice(0, INVOICE_PAPER_LIMIT).map((entry) => entry.id),
        ),
        organizationService.get(ctx),
      ])
      const periodText =
        settings.period === 'all-dates'
          ? 'All dates'
          : `${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}`
      const invoicesBody = [
        `Invoices — ${customer.displayName}`,
        ctx.organization.name,
        periodText,
        ...documents.map(
          (document) =>
            `${document.number} · ${formatTransactionDate(toCalendarDate(document.date), document.createdAt, ctx.organization.timeZone)} · ${formatMoney(document.total, currency)}`,
        ),
        `Balance ${formatMoney(statement.closing, currency)}`,
      ].join('\n')
      return (
        <>
          <PageHeader
            className="print:hidden"
            title="Customer statement"
            description={`${customer.displayName} · ${periodText} · Invoice by invoice`}
            actions={
              <PrintButton
                paper="invoices"
                filename={`invoices-${customer.displayName
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '')
                  .slice(0, 40) || 'customer'}.pdf`}
                defaultTo={customer.email ?? ''}
                defaultSubject={`Invoices from ${ctx.organization.name}`}
                defaultBody={invoicesBody}
                whatsappPhone={customer.phone}
                whatsappText={invoicesBody}
              />
            }
          />
          {controls}
          <StatementInvoices
            organization={organization}
            baseCurrency={currency}
            customer={{
              displayName: customer.displayName,
              companyName: customer.companyName,
              email: customer.email,
              address,
            }}
            from={settings.range.from}
            to={settings.range.to}
            allDates={settings.period === 'all-dates'}
            caption={statementFilterCaption({ ...customerFilter, type: 'all' })}
            documents={documents}
            omitted={Math.max(0, invoices.length - INVOICE_PAPER_LIMIT)}
            closing={statement.closing}
          />
        </>
      )
    }

    const pdfParams = new URLSearchParams()
    pdfParams.set('customerId', subjectId)
    for (const key of ['period', 'from', 'to', 'asOf', 'view', 'type', 'status']) {
      const value = one(query[key])
      if (value) pdfParams.set(key, value)
    }
    const filename = `statement-${customer.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'customer'}.pdf`
    const emailBody = statementEmailBody({
      orgName: ctx.organization.name,
      organization: ctx.organization,
      customerName: customer.displayName,
      from: settings.range.from,
      to: settings.range.to,
      filter: customerFilter,
      currency,
      opening: statement.opening,
      closing: statement.closing,
      entries,
    })

    return (
      <>
        <PageHeader
          className="print:hidden"
          title="Customer statement"
          description={`${customer.displayName} · ${
            settings.period === 'all-dates'
              ? 'All dates'
              : `${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}`
          }`}
          actions={
            <StatementSend
              pdfHref={`/api/statements/customer?${pdfParams.toString()}`}
              filename={filename}
              defaultTo={customer.email ?? ''}
              defaultSubject={`Statement from ${ctx.organization.name}`}
              defaultBody={emailBody}
              whatsappPhone={customer.phone}
            />
          }
        />
        {controls}
        <CustomerStatement
          currency={currency}
          customer={{
            displayName: customer.displayName,
            companyName: customer.companyName,
            email: customer.email,
            phone: customer.phone,
            address,
          }}
          from={settings.range.from}
          to={settings.range.to}
          filter={customerFilter}
          ledger={customerFilter.type === 'all' && customerFilter.status === 'all'}
          caption={statementFilterCaption(customerFilter)}
          opening={statement.opening}
          closing={statement.closing}
          charges={charges}
          credits={credits}
          entries={entries}
        />
      </>
    )
  } else if (kind === 'vendor') {
    const vendor = vendors.find((row) => row.id === subjectId)
    if (!vendor || !vendorFilter) notFound()
    const statement = await payables.vendorStatement(ctx, subjectId, settings.range)
    const entries = visibleVendorEntries(statement.entries, vendorFilter, settings.asOf)
    const charges = statement.entries.reduce((sum, entry) => sum.plus(entry.charge), ZERO)
    const credits = statement.entries.reduce((sum, entry) => sum.plus(entry.credit), ZERO)
    const address = [
      [vendor.billingLine1, vendor.billingLine2].filter(Boolean).join(', '),
      [vendor.billingCity, vendor.billingRegion, vendor.billingPostalCode].filter(Boolean).join(' '),
    ].filter(Boolean)
    const vendorBody = [
      `Vendor statement — ${vendor.displayName}`,
      ctx.organization.name,
      settings.period === 'all-dates'
        ? 'All dates'
        : `${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}`,
      `Closing ${formatMoney(statement.closing, currency)}`,
    ].join('\n')
    return (
      <>
        <PageHeader
          className="print:hidden"
          title="Vendor statement"
          description={`${vendor.displayName} · ${
            settings.period === 'all-dates'
              ? 'All dates'
              : `${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}`
          }`}
          actions={
            <PrintButton
              paper="vendor statement"
              defaultTo={vendor.email ?? ''}
              defaultSubject={`Vendor statement from ${ctx.organization.name}`}
              defaultBody={vendorBody}
              whatsappPhone={vendor.phone}
              whatsappText={vendorBody}
            />
          }
        />
        {controls}
        <CustomerStatement
          currency={currency}
          customer={{
            displayName: vendor.displayName,
            companyName: vendor.companyName,
            email: vendor.email,
            phone: vendor.phone,
            address,
          }}
          from={settings.range.from}
          to={settings.range.to}
          filter={vendorFilter}
          ledger={vendorFilter.type === 'all' && vendorFilter.status === 'all'}
          caption={vendorFilterCaption(vendorFilter)}
          opening={statement.opening}
          closing={statement.closing}
          charges={charges}
          credits={credits}
          entries={entries}
          debitLabel="Bills"
          creditLabel="Paid"
        />
      </>
    )
  } else {
    const account = chart.find((row) => row.id === subjectId)
    if (!account) notFound()
    subjectName = `${account.code} — ${account.name}`
    const ledger = await generalLedger(ctx.orgId, subjectId, settings.range, { limit: 1000 })
    opening = ledger.opening
    closing = ledger.closing
    chargeLabel = 'Debit'
    creditLabel = 'Credit'
    const sources = await resolveSources(
      ctx.orgId,
      ledger.entries.map((entry) => ({
        sourceType: entry.sourceType as JournalSourceType,
        sourceId: entry.sourceId,
      })),
    )
    lines = ledger.entries.map((entry) => {
      const source = sourceFor(sources, {
        sourceType: entry.sourceType as JournalSourceType,
        sourceId: entry.sourceId,
      })
      return {
        id: entry.lineId,
        recordedAt: entry.recordedAt.toISOString(),
        number: source.number ?? entry.journalNumber,
        description: entry.description ?? entry.memo ?? entry.contraAccounts,
        charge: entry.debit,
        credit: entry.credit,
        balance: entry.balance,
        href: source.href ?? `/journals/${entry.journalId}`,
      }
    })
  }

  const totalCharges = lines.reduce((sum, line) => sum.plus(line.charge), ZERO)
  const totalCredits = lines.reduce((sum, line) => sum.plus(line.credit), ZERO)

  return (
    <>
      <PageHeader
        className="print:hidden"
        title={TITLES[kind as Kind]}
        description={`${subjectName} · ${formatDate(settings.range.from)} to ${formatDate(
          settings.range.to,
        )}${settings.period === 'custom' ? '' : ` — ${PERIOD_LABELS[settings.period]}`}`}
        actions={
          <PrintButton
            paper="account statement"
            defaultSubject={`${TITLES[kind as Kind]} — ${subjectName}`}
            defaultBody={[
              TITLES[kind as Kind],
              subjectName,
              `${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}`,
              `Closing ${formatMoney(closing, currency)}`,
            ].join('\n')}
          />
        }
      />

      {controls}

      {/* The printed header. On screen the page header above says the same. */}
      <div className="mb-6 hidden print:block">
        <p className="text-sm">{TITLES[kind as Kind]} — {subjectName}</p>
        <p className="text-sm">
          {formatDate(settings.range.from)} to {formatDate(settings.range.to)}
        </p>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Summary label="Opening balance" value={formatMoney(opening, currency)} />
        <Summary label={chargeLabel} value={formatMoney(totalCharges, currency)} />
        <Summary label={creditLabel} value={formatMoney(totalCredits, currency)} />
        <Summary label="Closing balance" value={formatMoney(closing, currency)} emphasis />
      </div>

      <InteractiveGrid
        storageKey={`bp-account-statement-${subjectId}`}
        currency={currency}
        timeZone={ctx.organization.timeZone}
        customizable
        columns={[
          { id: 'date', label: 'Date', kind: 'datetime', defaultWidth: 188 },
          { id: 'document', label: 'Document', defaultWidth: 140 },
          { id: 'description', label: 'Description', defaultWidth: 240 },
          { id: 'charge', label: chargeLabel, kind: 'money', total: true, defaultWidth: 128 },
          { id: 'credit', label: creditLabel, kind: 'money', total: true, defaultWidth: 128 },
          { id: 'balance', label: 'Balance', kind: 'money', total: false, defaultWidth: 136 },
        ]}
        rows={[
          {
            id: 'opening',
            excludeFromTotal: true,
            emphasis: true,
            cells: {
              date: { value: settings.period === 'all-dates' ? null : settings.range.from },
              description: { value: 'Balance brought forward' },
              balance: { value: opening.toString() },
            },
          },
          ...lines.map((line) => ({
            id: line.id,
            cells: {
              date: { value: line.recordedAt },
              document: { value: line.number, href: line.href },
              description: { value: line.description, href: line.href },
              charge: { value: line.charge.isZero() ? null : line.charge.toString(), href: line.href },
              credit: { value: line.credit.isZero() ? null : line.credit.toString(), href: line.href },
              balance: { value: line.balance.toString(), href: line.href },
            },
          })),
        ]}
        footers={[
          {
            id: 'closing',
            label: `Closing balance at ${formatDate(settings.range.to)}`,
            cells: { balance: { value: closing.toString() } },
          },
        ]}
      />

      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing moved in this period. The balance brought forward is the balance carried forward.
        </p>
      ) : null}
    </>
  )
}

function Summary({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`tabular mt-0.5 ${emphasis ? 'text-lg font-semibold' : 'text-sm font-medium'}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

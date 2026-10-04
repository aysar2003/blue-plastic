import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { ClickableRow } from '@/components/reports/clickable-row'
import { PrintButton } from '@/app/(app)/sales/[type]/[id]/print/print-button'
import { StatementFilters } from '@/components/reports/statement-filters'
import { StatementSend } from '@/components/reports/statement-send'
import { Card, CardContent } from '@/components/ui/card'
import { readStatementFilter, statementFilterCaption, visibleEntries } from '@/lib/customer-statement'
import { readVendorFilter, vendorFilterCaption, vendorTypeOptions, visibleVendorEntries } from '@/lib/vendor-statement'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { accountOptions } from '@/lib/account-options'
import { formatDate, toCalendarDate } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { PERIOD_LABELS } from '@/lib/report-periods'
import { requireOrgContext } from '@/server/auth/context'
import { generalLedger } from '@/server/accounting/balances'
import { db } from '@/server/db'
import * as payables from '@/server/services/payables.service'
import * as receivables from '@/server/services/receivables.service'
import * as accountService from '@/server/services/account.service'
import { readSettings, type SearchParams } from '../../params'
import { ReportControls } from '../../report-controls'
import { CustomerStatement, statementEmailBody } from './customer-statement'
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
  const settings = readSettings(query, ctx.organization, 'this-fiscal-year')
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
    date: Date
    number: string
    description: string
    dueDate: Date | null
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
          actions={<PrintButton />}
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
    lines = ledger.entries.map((entry) => ({
      id: entry.lineId,
      date: entry.date,
      number: entry.journalNumber,
      description: entry.description ?? entry.memo ?? entry.contraAccounts,
      dueDate: null,
      charge: entry.debit,
      credit: entry.credit,
      balance: entry.balance,
      href: `/journals/${entry.journalId}`,
    }))
  }

  const totalCharges = lines.reduce((sum, line) => sum.plus(line.charge), ZERO)
  const totalCredits = lines.reduce((sum, line) => sum.plus(line.credit), ZERO)

  return (
    <>
      <PageHeader
        title={TITLES[kind as Kind]}
        description={`${subjectName} · ${formatDate(settings.range.from)} to ${formatDate(
          settings.range.to,
        )}${settings.period === 'custom' ? '' : ` — ${PERIOD_LABELS[settings.period]}`}`}
        actions={<PrintButton />}
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

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead className="w-36">Document</TableHead>
              <TableHead>Description</TableHead>
              {kind !== 'account' ? <TableHead className="w-28">Due</TableHead> : null}
              <TableHead className="numeric w-32">{chargeLabel}</TableHead>
              <TableHead className="numeric w-32">{creditLabel}</TableHead>
              <TableHead className="numeric w-32">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/40">
              <TableCell className="tabular whitespace-nowrap">
                {settings.period === 'all-dates' ? '—' : formatDate(settings.range.from)}
              </TableCell>
              <TableCell />
              <TableCell colSpan={kind !== 'account' ? 2 : 1} className="font-medium">
                Balance brought forward
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="numeric tabular font-medium">
                {formatMoney(opening, currency)}
              </TableCell>
            </TableRow>

            {lines.map((line) => (
              <ClickableRow key={line.id} href={line.href}>
                <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                  {formatDate(toCalendarDate(line.date))}
                </TableCell>
                <TableCell className="tabular">
                  <Link href={line.href} className="font-medium underline-offset-4 hover:underline">
                    {line.number}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{line.description}</TableCell>
                {kind !== 'account' ? (
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                    {line.dueDate ? formatDate(toCalendarDate(line.dueDate)) : '—'}
                  </TableCell>
                ) : null}
                <TableCell className="numeric tabular">
                  {line.charge.isZero() ? (
                    ''
                  ) : (
                    <Link href={line.href} className="underline-offset-4 hover:underline">
                      {formatMoney(line.charge, currency)}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="numeric tabular">
                  {line.credit.isZero() ? (
                    ''
                  ) : (
                    <Link href={line.href} className="underline-offset-4 hover:underline">
                      {formatMoney(line.credit, currency)}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="numeric tabular font-medium">
                  <Link href={line.href} className="underline-offset-4 hover:underline">
                    {formatMoney(line.balance, currency)}
                  </Link>
                </TableCell>
              </ClickableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={kind !== 'account' ? 4 : 3} className="font-semibold">
                Closing balance at {formatDate(settings.range.to)}
              </TableCell>
              <TableCell className="numeric tabular font-semibold">
                {formatMoney(totalCharges, currency)}
              </TableCell>
              <TableCell className="numeric tabular font-semibold">
                {formatMoney(totalCredits, currency)}
              </TableCell>
              <TableCell className="numeric tabular font-semibold">
                {formatMoney(closing, currency)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>

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

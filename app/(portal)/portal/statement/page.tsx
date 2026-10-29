import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'

import { StatementInvoices } from '@/app/(app)/reports/statements/[kind]/statement-invoices'
import { PageHeader } from '@/components/data/page-header'
import { PortalBalanceStatement } from '@/components/portal/portal-balance-statement'
import { PortalPrintButton } from '@/components/portal/portal-print-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import {
  invoiceChainBalances,
  statementFilterCaption,
  statementInvoices,
} from '@/lib/customer-statement'
import { formatDate, today } from '@/lib/date'
import { describeCustomerBalance } from '@/lib/portal-balance'
import { formatMoney, ZERO } from '@/lib/money'
import { EARLIEST_DATE, resolvePeriod } from '@/lib/report-periods'
import { cn } from '@/lib/utils'
import { requirePortalContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as organizationService from '@/server/services/organization.service'
import * as portalService from '@/server/services/portal.service'
import * as salesService from '@/server/services/sales.service'

export const metadata: Metadata = { title: 'Statements' }

const INVOICE_PAPER_LIMIT = 200

type ReportKind = 'balance' | 'invoices'

export default async function PortalStatementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requirePortalContext()
  const params = await searchParams
  const asOf = today(ctx.organization.timeZone)
  const defaults = resolvePeriod(
    'year-to-date',
    asOf,
    ctx.organization.fiscalYearStartMonth ?? 1,
  )
  const report: ReportKind = params.report === 'invoices' ? 'invoices' : 'balance'
  // Balance sheet runs Balance from 0 → closing, so default to all dates
  // unless the customer picked a range.
  const hasExplicitRange =
    (typeof params.from === 'string' && Boolean(params.from)) ||
    (typeof params.to === 'string' && Boolean(params.to)) ||
    params.all === '1'
  const from =
    typeof params.from === 'string' && params.from
      ? params.from
      : params.all === '1' || (report === 'balance' && !hasExplicitRange)
        ? EARLIEST_DATE
        : defaults.from
  const to = typeof params.to === 'string' && params.to ? params.to : defaults.to

  const [statement, customer] = await Promise.all([
    portalService.statement(ctx, { from, to }),
    db.customer.findFirst({
      where: { id: ctx.portalCustomerId, orgId: ctx.orgId },
      select: {
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
    }),
  ])

  const currency = ctx.organization.baseCurrency
  const closingCopy = describeCustomerBalance(statement.closing, currency)
  const customerName = customer?.companyName || customer?.displayName || 'Your account'
  const address = customer
    ? [
        [customer.billingLine1, customer.billingLine2].filter(Boolean).join(', '),
        [customer.billingCity, customer.billingRegion, customer.billingPostalCode]
          .filter(Boolean)
          .join(' '),
      ].filter(Boolean)
    : []

  const pdfHref = `/api/statements/customer?customerId=${encodeURIComponent(ctx.portalCustomerId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&view=detail&type=all&status=all`
  const queryBase = new URLSearchParams()
  if (from !== defaults.from || params.from) queryBase.set('from', from)
  if (to !== defaults.to || params.to) queryBase.set('to', to)
  if (from <= EARLIEST_DATE) queryBase.set('all', '1')

  const balanceHref = `/portal/statement?${new URLSearchParams({
    ...Object.fromEntries(queryBase),
    report: 'balance',
  }).toString()}`
  const invoicesHref = `/portal/statement?${new URLSearchParams({
    ...Object.fromEntries(queryBase),
    report: 'invoices',
  }).toString()}`

  let invoicesPaper: ReactNode = null
  if (report === 'invoices') {
    const invoiceEntries = statementInvoices(
      statement.entries,
      { view: 'invoices', type: 'invoice', status: 'all', totals: 'line' },
      asOf,
    )
    const [documents, organization, template] = await Promise.all([
      salesService.getMany(
        ctx,
        invoiceEntries.slice(0, INVOICE_PAPER_LIMIT).map((entry) => entry.id),
      ),
      organizationService.get(ctx),
      organizationService.getPrintTemplate(ctx),
    ])
    // Each paper's Previous = Balance at the bottom of the previous invoice
    // (Previous + Debit − Credit carried forward).
    const chain = invoiceChainBalances(documents, from <= EARLIEST_DATE ? ZERO : statement.opening)
    invoicesPaper = (
      <StatementInvoices
        organization={organization}
        baseCurrency={currency}
        customer={{
          displayName: customer?.displayName ?? customerName,
          companyName: customer?.companyName ?? null,
          email: customer?.email ?? null,
          address,
        }}
        from={from}
        to={to}
        allDates={from <= EARLIEST_DATE}
        caption={statementFilterCaption({
          view: 'invoices',
          type: 'invoice',
          status: 'all',
          totals: 'line',
        })}
        documents={documents}
        omitted={Math.max(0, invoiceEntries.length - INVOICE_PAPER_LIMIT)}
        closing={chain.closing}
        opening={from <= EARLIEST_DATE ? ZERO : statement.opening}
        accountAt={chain.accountAt}
        part="invoices"
        paper="merchant"
        template={template}
        documentHref={(document) => `/portal/invoices/${document.id}`}
      />
    )
  }

  const debitTotal = statement.entries.reduce((sum, row) => sum.plus(row.charge), ZERO)
  const creditTotal = statement.entries.reduce((sum, row) => sum.plus(row.credit), ZERO)

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <PageHeader
          title="Statements & reports"
          description="Balance sheet lists invoices with Balance from 0 to the closing amount. Or print invoice by invoice."
          actions={
            <div className="flex flex-wrap gap-2">
              <PortalPrintButton />
              {report === 'balance' ? (
                <a href={pdfHref} className={cn(buttonVariants({ size: 'sm' }))}>
                  Download PDF
                </a>
              ) : null}
            </div>
          }
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={balanceHref}
            className={cn(
              buttonVariants({ variant: report === 'balance' ? 'default' : 'outline', size: 'sm' }),
            )}
          >
            Customer balance sheet
          </Link>
          <Link
            href={invoicesHref}
            className={cn(
              buttonVariants({ variant: report === 'invoices' ? 'default' : 'outline', size: 'sm' }),
            )}
          >
            Invoice by invoice
          </Link>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Period</CardTitle>
            <CardDescription>
              {from <= EARLIEST_DATE ? `All dates through ${formatDate(to)}` : `${formatDate(from)} – ${formatDate(to)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-wrap items-end gap-3" method="get">
              <input type="hidden" name="report" value={report} />
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">From</span>
                <input
                  type="date"
                  name="from"
                  defaultValue={from <= EARLIEST_DATE ? '' : from}
                  className="h-9 rounded-md border bg-background px-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">To</span>
                <input
                  type="date"
                  name="to"
                  defaultValue={to}
                  className="h-9 rounded-md border bg-background px-2"
                />
              </label>
              <button type="submit" className={cn(buttonVariants({ variant: 'outline' }))}>
                Update
              </button>
              <Link
                href={`/portal/statement?report=${report}&all=1&to=${encodeURIComponent(asOf)}`}
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
              >
                All dates
              </Link>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Opening</CardDescription>
              <CardTitle className="tabular tracking-tight">
                {formatMoney(statement.opening, currency)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Debit (billed)</CardDescription>
              <CardTitle className="tabular tracking-tight">
                {formatMoney(debitTotal, currency)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Credit (paid / credited)</CardDescription>
              <CardTitle className="tabular tracking-tight">
                {formatMoney(creditTotal, currency)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{closingCopy.title}</CardDescription>
              <CardTitle className="tabular tracking-tight">{closingCopy.amountLabel}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {closingCopy.explanation}
            </CardContent>
          </Card>
        </div>
      </div>

      {report === 'balance' ? (
        <PortalBalanceStatement
          companyName={ctx.organization.name}
          customerName={customerName}
          currency={currency}
          from={from}
          to={to}
          opening={statement.opening}
          entries={statement.entries}
        />
      ) : (
        invoicesPaper
      )}
    </div>
  )
}

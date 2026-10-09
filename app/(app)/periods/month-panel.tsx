import Link from 'next/link'
import { FileTextIcon } from 'lucide-react'
import type { JournalSourceType } from '@prisma/client'

import { EmptyState } from '@/components/data/empty-state'
import { SearchInput } from '@/components/data/search-input'
import { HoverEntry } from '@/components/periods/hover-entry'
import {
  EXPENSE_COLOR,
  FigureChart,
  INCOME_COLOR,
  NET_COLOR,
  statementPicture,
} from '@/components/reports/figure-chart'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { JOURNAL_SOURCE_LABELS, PERIOD_STATUS_LABELS } from '@/lib/accounting-labels'
import { MONTHS } from '@/lib/constants'
import { formatDate, formatTransactionDate, toCalendarDate } from '@/lib/date'
import { listHref } from '@/lib/list-filters'
import { formatMoney } from '@/lib/money'
import type { ListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as journalService from '@/server/services/journal.service'
import * as periodService from '@/server/services/period.service'
import { profitAndLoss } from '@/server/reports/statements'
import { PeriodToggle } from './period-actions'

const REPORTS = [
  { href: '/reports/profit-loss', label: 'Profit and loss' },
  { href: '/reports/balance-sheet', label: 'Balance sheet' },
  { href: '/reports/cash-flow', label: 'Cash flow' },
  { href: '/reports/trial-balance', label: 'Trial balance' },
  { href: '/reports/transaction-detail', label: 'Transaction detail' },
  { href: '/reports/general-ledger', label: 'General ledger' },
  { href: '/reports/sales-by-customer', label: 'Sales by customer' },
  { href: '/reports/expenses-by-category', label: 'Expenses' },
  { href: '/reports/inventory-cost-change', label: 'Inventory cost' },
]

export function monthLabel(periodNumber: number, start: Date) {
  if (periodNumber === 0) return 'Opening balances'
  return `${MONTHS[(start.getUTCMonth() + 12) % 12]} ${start.getUTCFullYear()}`
}

function chipClass(on: boolean) {
  return on
    ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
    : 'rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border hover:bg-accent'
}

export async function MonthPanel({
  periodId,
  query,
  source,
  basePath,
  linkParams,
}: {
  periodId: string
  query: ListQuery
  source?: string
  basePath: string
  linkParams: Record<string, string | undefined>
}) {
  const ctx = await requireOrgContext('period:read')
  const period = await periodService.find(ctx, periodId)
  if (!period) return null

  return monthBody(ctx, period, query, source, basePath, linkParams)
}

async function monthBody(
  ctx: Awaited<ReturnType<typeof requireOrgContext>>,
  period: NonNullable<Awaited<ReturnType<typeof periodService.find>>>,
  query: ListQuery,
  source: string | undefined,
  basePath: string,
  linkParams: Record<string, string | undefined>,
) {

  const from = toCalendarDate(period.startDate)
  const to = toCalendarDate(period.endDate)
  const label = monthLabel(period.periodNumber, period.startDate)
  const canReadJournals = ctx.permissions.has('journal:read')
  const canReadReports = ctx.permissions.has('report:read')
  const sourceType = source && source in JOURNAL_SOURCE_LABELS ? (source as JournalSourceType) : undefined
  const journals = canReadJournals
    ? await journalService.list(ctx, query, {
        sort: 'date',
        dir: 'asc',
        from,
        to,
        sourceType,
        unpaged: true,
      })
    : null
  const rows = journals?.rows ?? []
  const analysis = canReadReports ? await profitAndLoss(ctx.orgId, { from, to }) : null
  const picture = analysis ? statementPicture(analysis.sections, 'total') : null
  const kept = { ...linkParams, q: query.q, source: sourceType }
  const chip = (extra: Record<string, string | undefined>) => `${listHref(basePath, { ...kept, ...extra })}#opened`
  const exportHref = (format: 'pdf' | 'xlsx') => {
    const search = new URLSearchParams({ format })
    if (query.q) search.set('q', query.q)
    if (sourceType) search.set('source', sourceType)
    return `/api/periods/${period.id}/export?${search.toString()}`
  }
  const reportQuery = `period=custom&from=${from}&to=${to}&asOf=${to}`
  const closed = period.status === 'CLOSED'
  const currency = ctx.organization.baseCurrency

  return (
    <section id="opened" className="scroll-mt-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{label}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatDate(from)} — {formatDate(to)}. Entries posted in this month, and the reports for the same dates.
          </p>
        </div>
        {closed ? (
          <PeriodToggle
            periodId={period.id}
            status={period.status}
            label={label}
            canClose={false}
            canReopen={ctx.permissions.has('period:reopen')}
            openLabel="Open"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={period.status === 'OPEN' ? 'success' : period.status === 'CLOSED' ? 'warning' : 'secondary'}>
          {PERIOD_STATUS_LABELS[period.status]}
        </Badge>
        <p className="text-sm text-muted-foreground">
          {closed
            ? 'This month is closed. Open it to change what was posted here, then search the entries below.'
            : 'Search the entries, or open a report for these dates.'}
        </p>
      </div>

      {picture ? (
        <FigureChart
          caption={`Analysis for ${label}`}
          currency={currency}
          bars={[
            { label: 'Income', value: picture.income, color: INCOME_COLOR },
            { label: 'Expenses', value: picture.expenses, color: EXPENSE_COLOR },
            { label: 'Net income', value: picture.net, color: NET_COLOR },
          ]}
        />
      ) : null}

      {canReadReports ? (
        <Card className="p-4">
          <p className="text-sm font-medium">Reports for {label}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {REPORTS.map((report) => (
              <Link
                key={report.href}
                href={`${report.href}?${reportQuery}`}
                className="rounded-md bg-secondary px-2.5 py-1 text-sm hover:bg-secondary/80"
              >
                {report.label}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold">Entries</h3>
        {canReadJournals ? <SearchInput placeholder="Search number, description, customer or vendor" /> : null}
        {journals ? <span className="tabular text-sm text-muted-foreground">{rows.length}</span> : null}
        {canReadJournals ? (
          <div className="ml-auto flex gap-2">
            <a href={exportHref('pdf')} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
              PDF
            </a>
            <a href={exportHref('xlsx')} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
              Excel
            </a>
          </div>
        ) : null}
      </div>

      {canReadJournals ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            <Link href={chip({ source: undefined })} aria-current={sourceType ? undefined : 'page'} className={chipClass(!sourceType)}>
              All types
            </Link>
            {Object.entries(JOURNAL_SOURCE_LABELS).map(([value, name]) => (
              <Link key={value} href={chip({ source: value })} aria-current={sourceType === value ? 'page' : undefined} className={chipClass(sourceType === value)}>
                {name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {!canReadJournals ? null : rows.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title={query.q || sourceType ? 'No entries match' : 'Nothing posted in this month'}
          description={query.q || sourceType ? 'Try another search or type.' : 'Entries dated in this month show up here.'}
        />
      ) : (
        <div className="max-h-[70vh] overflow-y-auto rounded-xl ring-1 ring-slate-300/70">
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="ledger-head hover:bg-[var(--band)]">
                <TableHead className="bg-[var(--band)]">Entry</TableHead>
                <TableHead className="bg-[var(--band)]">Date</TableHead>
                <TableHead className="bg-[var(--band)]">Description</TableHead>
                <TableHead className="bg-[var(--band)]">Source</TableHead>
                <TableHead className="bg-[var(--band)]">Document</TableHead>
                <TableHead className="bg-[var(--band)]">Customer / vendor</TableHead>
                <TableHead className="numeric bg-[var(--band)]">Amount</TableHead>
              </TableRow>
            </TableHeader>
            {rows.map((journal, index) => {
              return (
                <HoverEntry
                  key={journal.id}
                  stripe={index % 2 === 1}
                  currency={currency}
                  lines={journal.lines ?? []}
                >
                  <TableCell>
                    <Link href={`/journals/${journal.id}`} className="tabular font-medium underline-offset-4 hover:underline">
                      {journal.journalNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                    {formatTransactionDate(toCalendarDate(journal.date), journal.postedAt, ctx.organization.timeZone)}
                  </TableCell>
                  <TableCell>{journal.memo ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {JOURNAL_SOURCE_LABELS[journal.sourceType as JournalSourceType] ?? journal.sourceType}
                  </TableCell>
                  <TableCell className="tabular">
                    {journal.source.href && journal.source.number ? (
                      <Link href={journal.source.href} className="underline-offset-4 hover:underline">
                        {journal.source.number}
                      </Link>
                    ) : (
                      journal.source.number ?? '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {journal.source.partyHref && journal.source.partyName ? (
                      <Link href={journal.source.partyHref} className="underline-offset-4 hover:underline">
                        {journal.source.partyName}
                      </Link>
                    ) : (
                      journal.source.partyName ?? '—'
                    )}
                  </TableCell>
                  <TableCell className="numeric tabular">{formatMoney(journal.total, currency)}</TableCell>
                </HoverEntry>
              )
            })}
          </table>
        </div>
      )}
    </section>
  )
}

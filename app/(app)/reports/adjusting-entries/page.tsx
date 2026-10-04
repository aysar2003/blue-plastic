import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { ClickableRow } from '@/components/reports/clickable-row'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, toCalendarDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { adjustingEntries } from '@/server/accounting/close-checklist'
import { requireOrgContext } from '@/server/auth/context'
import { ReportControls } from '../report-controls'
import { readSettings, type SearchParams } from '../params'

export const metadata: Metadata = { title: 'Adjusting Journal Entries' }

/**
 * Adjusting and closing entries, on their own.
 *
 * These are the entries nobody in the business made — accruals, depreciation,
 * corrections, the year-end sweep — so they are the first thing an accountant or
 * an auditor asks to see, and the last thing anyone should have to find by
 * scrolling the journal.
 */
export default async function AdjustingEntriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const query = await searchParams
  const settings = readSettings(query, ctx.organization)
  const currency = ctx.organization.baseCurrency

  const report = await adjustingEntries(ctx.orgId, settings.range)

  return (
    <>
      <PageHeader
        title="Adjusting Journal Entries"
        description={`Adjusting and year-end entries between ${formatDate(settings.range.from)} and ${formatDate(settings.range.to)}.`}
      />

      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'range' }}
      />

      {report.rows.length === 0 ? (
        <EmptyState
          title="No adjusting entries"
          description="Nothing in this period was flagged as an adjustment, and the year has not been closed. A manual journal can be marked as adjusting when it is entered."
        />
      ) : (
        <div className="space-y-4">
          {report.rows.map((journal) => (
            <Card key={journal.id} className="overflow-hidden p-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/50 px-3 py-2">
                <div className="min-w-0">
                  <Link
                    href={`/journals/${journal.id}`}
                    className="text-sm font-semibold underline-offset-4 hover:underline"
                  >
                    {journal.journalNumber}
                  </Link>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {formatDate(toCalendarDate(journal.date))} · {journal.memo ?? 'No description'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {journal.isClosingEntry ? <Badge variant="secondary">year-end</Badge> : null}
                  {journal.isAdjusting ? <Badge variant="warning">adjusting</Badge> : null}
                  {journal.status === 'REVERSED' ? <Badge variant="secondary">reversed</Badge> : null}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Number</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="numeric w-36">Debit</TableHead>
                    <TableHead className="numeric w-36">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journal.lines.map((line) => (
                    <ClickableRow
                      key={line.id}
                      href={`/reports/transaction-detail?account=${line.account.id}&period=custom&from=${settings.range.from}&to=${settings.range.to}&back=/reports/adjusting-entries`}
                    >
                      <TableCell className="tabular text-muted-foreground">{line.account.code}</TableCell>
                      <TableCell>
                        <Link
                          href={`/reports/transaction-detail?account=${line.account.id}&period=custom&from=${settings.range.from}&to=${settings.range.to}&back=/reports/adjusting-entries`}
                          className="underline-offset-4 hover:underline"
                        >
                          {line.account.name}
                        </Link>
                        {line.description ? (
                          <span className="ml-2 text-xs text-muted-foreground">{line.description}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="numeric tabular">
                        {line.debit.isZero() ? '' : formatMoney(line.debit, currency)}
                      </TableCell>
                      <TableCell className="numeric tabular">
                        {line.credit.isZero() ? '' : formatMoney(line.credit, currency)}
                      </TableCell>
                    </ClickableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}

          <p className="text-sm text-muted-foreground">
            {report.rows.length} {report.rows.length === 1 ? 'entry' : 'entries'} totalling{' '}
            <span className="tabular">{formatMoney(report.total, currency)}</span>.
          </p>
        </div>
      )}
    </>
  )
}

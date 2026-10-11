import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import { formatSigned } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { companySnapshots } from '@/server/reports/company-consolidation'
import { groupReportScope } from '@/server/services/company-group.service'
import { ReportControls } from '../report-controls'
import { readSettings, type SearchParams } from '../params'
import { OpenCompanyReport } from './open-company-report'

export const metadata: Metadata = { title: 'Company group' }

/**
 * Consolidated books for a company group (main + subs), or every company for
 * the system owner. Staff outside the group stay on single-company reports.
 */
export default async function CompanyReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const scope = await groupReportScope(ctx)
  if (scope.orgIds !== 'all' && scope.orgIds.length === 0) redirect('/reports')

  const query = await searchParams
  const settings = readSettings(query, ctx.organization, 'this-month')
  const { rows, totals } = await companySnapshots(settings.range, {
    orgIds: scope.orgIds,
  })

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title={scope.title}
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}. Each company keeps its own books. Sales income, expenses, and net income are for the period. Cash, equity, opening balance, retained earnings, customers owe, and bills to pay are as of the period end.`}
      />
      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison="none"
        controls={{ mode: 'range' }}
      />
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Equity</TableHead>
              <TableHead className="text-right">Customers owe</TableHead>
              <TableHead className="text-right">Bills to pay</TableHead>
              <TableHead className="text-right">Cash on hand</TableHead>
              <TableHead className="text-right">Sales income</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Net income</TableHead>
              <TableHead className="text-right">Opening balance</TableHead>
              <TableHead className="text-right">Retained earnings</TableHead>
              <TableHead className="w-[1%] print:hidden" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-muted-foreground">
                  No companies yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="block font-medium">{row.name}</span>
                    {row.legalName && row.legalName !== row.name ? (
                      <span className="block text-xs text-muted-foreground">{row.legalName}</span>
                    ) : null}
                    {row.parentOrgId || scope.rootOrgId === row.id || row.id === ctx.orgId ? (
                      <span className="block text-xs text-muted-foreground">
                        {[
                          row.parentOrgId
                            ? 'Sub'
                            : scope.rootOrgId === row.id ||
                                (scope.orgIds !== 'all' && !row.parentOrgId)
                              ? 'Main'
                              : null,
                          row.id === ctx.orgId ? 'Current' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{row.currency}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(row.equity, row.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(row.receivable, row.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(row.payable, row.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(row.cash, row.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(row.income, row.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(row.expenses, row.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatSigned(row.netIncome, row.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(row.openingBalance, row.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(row.retainedEarnings, row.currency)}
                  </TableCell>
                  <TableCell className="text-right print:hidden">
                    <OpenCompanyReport orgId={row.id} current={row.id === ctx.orgId} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {totals.length > 0 ? (
            <TableFooter>
              {totals.map((total) => (
                <TableRow key={total.currency}>
                  <TableCell colSpan={2} className="font-medium">
                    {scope.orgIds === 'all' ? 'All companies' : 'Group'} · {total.currency}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {total.companies} {total.companies === 1 ? 'company' : 'companies'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(total.equity, total.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(total.receivable, total.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(total.payable, total.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(total.cash, total.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(total.income, total.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(total.expenses, total.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatSigned(total.netIncome, total.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(total.openingBalance, total.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSigned(total.retainedEarnings, total.currency)}
                  </TableCell>
                  <TableCell className="print:hidden" />
                </TableRow>
              ))}
            </TableFooter>
          ) : null}
        </Table>
        </div>
      </Card>
    </>
  )
}

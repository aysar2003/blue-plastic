import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { profitByClass } from '@/server/reports/profit-by-class'
import { ReportControls } from '../../report-controls'
import { readSettings, type SearchParams } from '../../params'

export const metadata: Metadata = { title: 'Profit and Loss by Class' }

export default async function ProfitAndLossByClassPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const settings = readSettings(await searchParams, ctx.organization)
  const report = await profitByClass(ctx.orgId, settings.range)
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title="Profit and Loss by Class"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}. Income and expenses on journal lines, grouped by class. Lines with no class are Unclassified.`}
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
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead className="numeric">Income</TableHead>
              <TableHead className="numeric">Expenses</TableHead>
              <TableHead className="numeric">Net income</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No income or expense was posted in this period.
                </TableCell>
              </TableRow>
            ) : (
              report.rows.map((row) => (
                <TableRow key={row.id ?? 'unclassified'}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="numeric tabular">{formatMoney(row.income, currency)}</TableCell>
                  <TableCell className="numeric tabular">{formatMoney(row.expense, currency)}</TableCell>
                  <TableCell className="numeric tabular">{formatMoney(row.netIncome, currency)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {report.rows.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="numeric tabular">{formatMoney(report.income, currency)}</TableCell>
                <TableCell className="numeric tabular">{formatMoney(report.expense, currency)}</TableCell>
                <TableCell className="numeric tabular">{formatMoney(report.netIncome, currency)}</TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </Card>
    </>
  )
}

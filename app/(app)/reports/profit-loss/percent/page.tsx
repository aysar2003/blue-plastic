import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { ReportControls } from '../../report-controls'
import { readSettings, type SearchParams } from '../../params'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { profitAndLoss } from '@/server/reports/statements'

export const metadata: Metadata = { title: 'Profit and Loss as % of income' }

function percent(amount: Decimal, income: Decimal): string {
  if (income.isZero()) return '—'
  return `${amount.dividedBy(income).times(100).toDecimalPlaces(1).toString()}%`
}

export default async function ProfitAndLossPercentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const ctx = await requireOrgContext('report:read')
  const settings = readSettings(await searchParams, ctx.organization)
  const report = await profitAndLoss(ctx.orgId, { ...settings.range, basis: settings.basis })
  const currency = ctx.organization.baseCurrency
  const income = report.totalIncome

  return (
    <>
      <PageHeader
        title="Profit and Loss as % of total income"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}. Each line is its share of income.`}
      />
      <ReportControls
        period={settings.period}
        from={settings.range.from}
        to={settings.range.to}
        asOf={settings.asOf}
        basis={settings.basis}
        comparison={settings.comparison}
        controls={{ mode: 'range', basis: true, exportAs: 'profit-loss' }}
      />
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="numeric">Amount</TableHead>
              <TableHead className="numeric">% of income</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.sections.flatMap((section) => [
              <TableRow key={section.key} className="bg-muted/40">
                <TableCell className="font-medium">{section.label}</TableCell>
                <TableCell className="numeric tabular font-medium">{formatMoney(section.total, currency)}</TableCell>
                <TableCell className="numeric tabular">{percent(section.total, income)}</TableCell>
              </TableRow>,
              ...section.rows.map((row) => (
                <TableRow key={row.accountId}>
                  <TableCell className="pl-8">
                    {row.code} {row.name}
                  </TableCell>
                  <TableCell className="numeric tabular">{formatMoney(row.amount, currency)}</TableCell>
                  <TableCell className="numeric tabular">{percent(row.amount, income)}</TableCell>
                </TableRow>
              )),
            ])}
            <TableRow>
              <TableCell className="font-semibold">Net income</TableCell>
              <TableCell className="numeric tabular font-semibold">{formatMoney(report.netIncome, currency)}</TableCell>
              <TableCell className="numeric tabular font-semibold">{percent(report.netIncome, income.isZero() ? ZERO : income)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

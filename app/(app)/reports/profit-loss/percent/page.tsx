import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { ClickableRow } from '@/components/reports/clickable-row'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { REPORT_DRILL_LINK } from '@/lib/report-drill'
import { requireOrgContext } from '@/server/auth/context'
import { profitAndLoss } from '@/server/reports/statements'
import { ReportControls } from '../../report-controls'
import { readSettings, type SearchParams } from '../../params'

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
  const drill = (accountId: string) =>
    `/reports/transaction-detail?account=${accountId}&period=custom&from=${settings.range.from}&to=${settings.range.to}&back=/reports/profit-loss/percent`

  return (
    <>
      <PageHeader
        organization={ctx.organization}
        title="Profit and Loss as % of total income"
        description={`${formatDate(settings.range.from)} to ${formatDate(settings.range.to)}. Each line is its share of income. Open a name or amount for that account's transactions.`}
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
              ...section.rows.map((row) => {
                const href = drill(row.accountId)
                return (
                  <ClickableRow key={row.accountId} href={href} title="Open transactions for this account">
                    <TableCell className="pl-8">
                      <Link href={href} className={REPORT_DRILL_LINK}>
                        <span className="tabular opacity-70">{row.code}</span> {row.name}
                      </Link>
                    </TableCell>
                    <TableCell className="numeric tabular">
                      <Link href={href} className={REPORT_DRILL_LINK}>
                        {formatMoney(row.amount, currency)}
                      </Link>
                    </TableCell>
                    <TableCell className="numeric tabular">
                      <Link href={href} className={REPORT_DRILL_LINK}>
                        {percent(row.amount, income)}
                      </Link>
                    </TableCell>
                  </ClickableRow>
                )
              }),
            ])}
            <TableRow>
              <TableCell className="font-semibold">Net income</TableCell>
              <TableCell className="numeric tabular font-semibold">{formatMoney(report.netIncome, currency)}</TableCell>
              <TableCell className="numeric tabular font-semibold">
                {percent(report.netIncome, income.isZero() ? ZERO : income)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

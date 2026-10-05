import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { endOfMonth, today } from '@/lib/date'
import { Decimal, formatMoney, ZERO } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { profitAndLoss } from '@/server/reports/statements'

export const metadata: Metadata = { title: 'Profit and Loss by Month' }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default async function ProfitAndLossByMonthPage() {
  const ctx = await requireOrgContext('report:read')
  const now = today(ctx.organization.timeZone)
  const year = now.slice(0, 4)
  const currency = ctx.organization.baseCurrency

  const reports = await Promise.all(
    MONTHS.map((_, index) => {
      const from = `${year}-${String(index + 1).padStart(2, '0')}-01`
      return profitAndLoss(ctx.orgId, { from, to: endOfMonth(from), basis: 'accrual' })
    }),
  )

  const rows = reports.map((report, index) => ({
    label: MONTHS[index] ?? '',
    income: report.totalIncome,
    expenses: report.totalCogs.plus(report.totalOperatingExpenses).plus(
      report.sections.find((section) => section.key === 'otherExpense')?.total ?? ZERO,
    ),
    net: report.netIncome,
  }))
  const totals = rows.reduce(
    (sum, row) => ({
      income: sum.income.plus(row.income),
      expenses: sum.expenses.plus(row.expenses),
      net: sum.net.plus(row.net),
    }),
    { income: ZERO, expenses: ZERO, net: ZERO },
  )

  return (
    <>
      <PageHeader
        title="Profit and Loss by Month"
        description={`Accrual basis for ${year}. Each month is read from the ledger on its own.`}
      />
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="numeric">Income</TableHead>
              <TableHead className="numeric">Expenses</TableHead>
              <TableHead className="numeric">Net income</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell>{row.label}</TableCell>
                <TableCell className="numeric tabular">{formatMoney(row.income, currency)}</TableCell>
                <TableCell className="numeric tabular">{formatMoney(row.expenses, currency)}</TableCell>
                <TableCell className="numeric tabular">{formatMoney(row.net, currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell className="numeric tabular">{formatMoney(totals.income, currency)}</TableCell>
              <TableCell className="numeric tabular">{formatMoney(totals.expenses, currency)}</TableCell>
              <TableCell className="numeric tabular">{formatMoney(totals.net, currency)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Expenses here are cost of goods sold, operating expenses, and other expenses. A month with no postings shows {formatMoney(new Decimal(0), currency)}.
      </p>
    </>
  )
}

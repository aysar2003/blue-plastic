import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { consolidatedGroup } from '@/server/reports/consolidation'

export const metadata: Metadata = { title: 'Consolidation' }

export default async function ConsolidationPage() {
  const ctx = await requireOrgContext('report:read')
  const result = await consolidatedGroup(ctx)
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Group consolidation"
        description="Combined profit and loss and balance-sheet totals for this company and its children. Journals whose memo starts with [IC] are skipped."
      />
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expense</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="text-right">Assets</TableHead>
              <TableHead className="text-right">Liabilities</TableHead>
              <TableHead className="text-right">Equity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.companies.map((row) => (
              <TableRow key={row.orgId}>
                <TableCell>{row.name}</TableCell>
                <TableCell className="text-right tabular">
                  {formatMoney(row.income.toFixed(2), currency)}
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatMoney(row.expense.toFixed(2), currency)}
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatMoney(row.net.toFixed(2), currency)}
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatMoney(row.assets.toFixed(2), currency)}
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatMoney(row.liabilities.toFixed(2), currency)}
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatMoney(row.equity.toFixed(2), currency)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-medium">Combined</TableCell>
              <TableCell className="text-right font-medium tabular">
                {formatMoney(result.totals.income.toFixed(2), currency)}
              </TableCell>
              <TableCell className="text-right font-medium tabular">
                {formatMoney(result.totals.expense.toFixed(2), currency)}
              </TableCell>
              <TableCell className="text-right font-medium tabular">
                {formatMoney(result.totals.net.toFixed(2), currency)}
              </TableCell>
              <TableCell className="text-right font-medium tabular">
                {formatMoney(result.totals.assets.toFixed(2), currency)}
              </TableCell>
              <TableCell className="text-right font-medium tabular">
                {formatMoney(result.totals.liabilities.toFixed(2), currency)}
              </TableCell>
              <TableCell className="text-right font-medium tabular">
                {formatMoney(result.totals.equity.toFixed(2), currency)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

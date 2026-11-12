import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
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
  const nci = result.totals.nci

  return (
    <>
      <PageHeader
        title="Group consolidation"
        description="Owned share of P&L and balance-sheet totals. Journals whose memo starts with [IC] are skipped. Minority interest (NCI) is the unowned equity share."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/reports/group-close"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Group close
            </Link>
            <Link
              href="/reports/intercompany"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              IC matches
            </Link>
          </div>
        }
      />
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Own %</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expense</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="text-right">Owned net</TableHead>
              <TableHead className="text-right">Assets</TableHead>
              <TableHead className="text-right">Liabilities</TableHead>
              <TableHead className="text-right">Equity</TableHead>
              <TableHead className="text-right">NCI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.companies.map((row) => (
              <TableRow key={row.orgId}>
                <TableCell>
                  {row.name}
                  {row.isParent ? (
                    <span className="ml-2 text-xs text-muted-foreground">main</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular">
                  {Number(row.ownershipPercent).toString()}
                </TableCell>
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
                  {formatMoney(row.ownedNet.toFixed(2), currency)}
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
                <TableCell className="text-right tabular">
                  {formatMoney(row.nci.toFixed(2), currency)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-medium">Owned combined</TableCell>
              <TableCell />
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
              <TableCell className="text-right font-medium tabular">
                {formatMoney(nci.toFixed(2), currency)}
              </TableCell>
            </TableRow>
            {nci.greaterThan(0) ? (
              <TableRow>
                <TableCell className="font-medium" colSpan={9}>
                  Non-controlling interest (NCI)
                </TableCell>
                <TableCell className="text-right font-medium tabular">
                  {formatMoney(nci.toFixed(2), currency)}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

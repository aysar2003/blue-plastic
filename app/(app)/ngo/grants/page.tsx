import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as ngo from '@/server/services/ngo.service'

export const metadata: Metadata = { title: 'Grant budget vs actual' }

export default async function NgoGrantsPage() {
  const ctx = await requireOrgContext('report:read')
  const rows = await ngo.grantBudgetReport(ctx)
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Grant budget vs actual"
        description="Budgets optionally tagged to a fund class. Actuals from posted journals in the budget window."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/ngo" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              NGO hub
            </Link>
            <Link
              href="/accounting/budgets"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Budgets
            </Link>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No grant budgets"
          description="Create a budget under Accounting → Budgets, optionally tag it to a fund class."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Budget</TableHead>
              <TableHead>Fund</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Budgeted</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Variance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.fund ?? '—'}</TableCell>
                <TableCell className="text-sm tabular">
                  {row.startDate} → {row.endDate}
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatMoney(row.budgeted, currency)}
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatMoney(row.actual, currency)}
                </TableCell>
                <TableCell className="text-right tabular">
                  {formatMoney(row.variance, currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}

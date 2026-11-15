import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as commitment from '@/server/services/commitment.service'

export const metadata: Metadata = { title: 'Commitments vs budget' }

export default async function CommitmentsPage() {
  const ctx = await requireOrgContext('report:read')
  const report = await commitment.commitmentReport(ctx)
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Open PO commitments"
        description="Encumbered purchase orders vs budget lines by tracking category."
        actions={
          <Link href="/accounting/budgets" className="text-sm text-primary underline-offset-4 hover:underline">
            Budgets
          </Link>
        }
      />

      <Card className="mb-4 p-4 text-sm text-muted-foreground">
        {report.openPoCount} open PO(s) · {report.budgetCount} budget(s) in scope.
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Class / fund</TableHead>
            <TableHead className="text-right">Open PO</TableHead>
            <TableHead className="text-right">Budget</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.rows.map((row, i) => (
            <TableRow key={row.trackingCategoryId ?? `none-${i}`}>
              <TableCell>{row.trackingCategoryName ?? 'Unclassified'}</TableCell>
              <TableCell className="text-right">{formatMoney(row.openPoTotal, currency)}</TableCell>
              <TableCell className="text-right">{formatMoney(row.budgetAmount, currency)}</TableCell>
              <TableCell className="text-right">{formatMoney(row.remaining, currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
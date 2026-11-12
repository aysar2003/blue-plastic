import type { Metadata } from 'next'
import Link from 'next/link'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as education from '@/server/services/education.service'

export const metadata: Metadata = { title: 'Fees outstanding by term' }

export default async function FeesOutstandingPage() {
  const ctx = await requireOrgContext('invoice:read')
  const rows = await education.feesOutstandingByTerm(ctx)
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Fees outstanding by term"
        description="Open tuition / fee invoices still owed, grouped by academic term."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Education hub
            </Link>
            <Link
              href="/education/enrollments"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Enrollments
            </Link>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No outstanding fees"
          description="Enroll students and bill fee plans to raise invoices. Paid balances drop off this list."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-right">Enrollments</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.termId}>
                    <TableCell className="font-medium">{row.termName}</TableCell>
                    <TableCell className="text-right tabular">{row.enrollmentCount}</TableCell>
                    <TableCell className="text-right tabular">{row.invoiceCount}</TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(row.outstanding, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  )
}

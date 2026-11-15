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
  const [rows, terms] = await Promise.all([
    education.feesOutstandingByTerm(ctx),
    education.listTerms(ctx),
  ])
  const scholarshipBlocks = await Promise.all(
    terms.slice(0, 12).map((term) => education.scholarshipSummary(ctx, term.id)),
  )
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
            <a
              href="/api/education/scholarship-summary"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
              download
            >
              Scholarship CSV
            </a>
          </div>
        }
      />

      {scholarshipBlocks.length > 0 ? (
        <Card className="mb-8">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-right">Enrollments</TableHead>
                  <TableHead className="text-right">Gross fees</TableHead>
                  <TableHead className="text-right">Scholarship waived</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scholarshipBlocks.map((block) => (
                  <TableRow key={block.term.id}>
                    <TableCell className="font-medium">{block.term.name}</TableCell>
                    <TableCell className="text-right tabular">{block.enrollmentCount}</TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(block.gross, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(block.scholarshipWaived, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {formatMoney(block.net, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

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

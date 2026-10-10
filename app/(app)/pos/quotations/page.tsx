import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { byType } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import * as posService from '@/server/services/pos.service'

export const metadata: Metadata = { title: 'POS Quotations' }

export default async function PosQuotationsPage() {
  const ctx = await requireOrgContext('invoice:read')
  const quotes = await posService.listOpenQuotations(ctx)

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Open quotes saved from the till. Full dashboard and form live under Sales → Quotations."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/sales/quotations" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Sales quotations
            </Link>
            <Link href="/sales/quotations/new" className={buttonVariants({ size: 'sm' })}>
              New quotation
            </Link>
            <Link href="/pos" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              ← Dashboard
            </Link>
          </div>
        }
      />

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => {
              const path = byType(quote.type).slug
              return (
                <TableRow key={quote.id}>
                  <TableCell className="text-muted-foreground">{quote.dateLabel}</TableCell>
                  <TableCell>
                    <Link
                      href={`/sales/${path}/${quote.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {quote.number}
                    </Link>
                  </TableCell>
                  <TableCell>{quote.customerName}</TableCell>
                  <TableCell className="text-right tabular">{quote.lineCount}</TableCell>
                  <TableCell className="text-right tabular font-medium">{quote.totalLabel}</TableCell>
                  <TableCell className="text-right">
                    <Link href="/pos" className="text-primary hover:underline">
                      Sell at till
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
            {quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No open quotations. On the till: add products → Actions → Save Quotation.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

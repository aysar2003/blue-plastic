import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as landedCostService from '@/server/services/landed-cost.service'

export const metadata: Metadata = { title: 'Landed costs' }

export default async function LandedCostsPage() {
  const ctx = await requireOrgContext('bill:read')
  const rows = await landedCostService.listForOrg(ctx)
  const currency = ctx.organization.baseCurrency

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <PageHeader
        title="Landed costs"
        description="Freight and duty from posted bills allocated onto inventory cost."
      />
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No allocations yet. Open a posted bill that has a freight/duty line and choose Allocate to
              receipts.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/purchases/bills/${row.billId}/landed-cost`}
                        className="underline-offset-2 hover:underline"
                      >
                        {row.billNumber}
                      </Link>
                      {row.journalNumber ? (
                        <span className="ml-2 text-xs text-muted-foreground">{row.journalNumber}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.vendorName ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.memo ?? '—'}</TableCell>
                    <TableCell className="text-right tabular">{formatMoney(row.total, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

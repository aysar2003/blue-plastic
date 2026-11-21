import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { selectableAccounts } from '@/server/services/account.service'
import * as settlement from '@/server/services/marketplace-settlement.service'

import { runSettlement, saveSeller } from './actions'

export const metadata: Metadata = { title: 'Marketplace settlements' }

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const query = await searchParams
  const todayStr = today(ctx.organization.timeZone)
  const monthStart = todayStr.slice(0, 8) + '01'
  const periodStart = query.from || monthStart
  const periodEnd = query.to || todayStr
  const [sellers, batches, statements, accounts] = await Promise.all([
    settlement.listSellers(ctx),
    settlement.listBatches(ctx),
    settlement.listSellerStatements(ctx, { periodStart, periodEnd }),
    selectableAccounts(ctx, { withBalances: false }),
  ])
  const banks = accounts.filter(
    (account) => account.subtype === 'BANK' || account.subtype === 'UNDEPOSITED_FUNDS',
  )
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader title="Marketplace settlements" description="Seller commission and period settlement batches." />

      <form action={saveSeller} className="mb-6 grid max-w-md gap-2 rounded-md border p-4">
        <p className="text-sm font-medium">Seller commission</p>
        <div>
          <Label htmlFor="vendorId">Vendor id</Label>
          <Input id="vendorId" name="vendorId" required />
        </div>
        <div>
          <Label htmlFor="commissionPercent">Commission %</Label>
          <Input id="commissionPercent" name="commissionPercent" defaultValue="10" />
        </div>
        <Button type="submit" size="sm">
          Save seller
        </Button>
      </form>

      <form action={runSettlement} className="mb-8 grid max-w-md gap-2 rounded-md border p-4">
        <p className="text-sm font-medium">Settle period</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="periodStart">From</Label>
            <Input id="periodStart" name="periodStart" type="date" defaultValue={periodStart} />
          </div>
          <div>
            <Label htmlFor="periodEnd">To</Label>
            <Input id="periodEnd" name="periodEnd" type="date" defaultValue={periodEnd} />
          </div>
        </div>
        <div>
          <Label htmlFor="paymentAccountId">Pay now (optional)</Label>
          <NativeSelect id="paymentAccountId" name="paymentAccountId" className="mt-1">
            <option value="">Vendor bill only</option>
            {banks.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} {account.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" size="sm">
          Run settlement
        </Button>
      </form>

      {statements.length > 0 ? (
        <Table className="mb-8">
          <TableHeader>
            <TableRow>
              <TableHead>Seller statement</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Payable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statements.map((row) => (
              <TableRow key={row.vendorId}>
                <TableCell>{row.vendorName}</TableCell>
                <TableCell className="text-right">{formatMoney(row.grossSales, currency)}</TableCell>
                <TableCell className="text-right">{formatMoney(row.commission, currency)}</TableCell>
                <TableCell className="text-right">{formatMoney(row.sellerPayable, currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <Table className="mb-8">
        <TableHeader>
          <TableRow>
            <TableHead>Seller</TableHead>
            <TableHead className="text-right">Commission %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sellers.map((row: (typeof sellers)[number]) => (
            <TableRow key={row.id}>
              <TableCell>{row.vendor.displayName}</TableCell>
              <TableCell className="text-right">{row.commissionPercent.toString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">Commission</TableHead>
            <TableHead className="text-right">Payable</TableHead>
            <TableHead>Bills</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((row: (typeof batches)[number]) => (
            <TableRow key={row.id}>
              <TableCell>
                {formatDate(row.periodStart.toISOString().slice(0, 10))} –{' '}
                {formatDate(row.periodEnd.toISOString().slice(0, 10))}
              </TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell className="text-right">{formatMoney(row.grossSales.toString(), currency)}</TableCell>
              <TableCell className="text-right">{formatMoney(row.commission.toString(), currency)}</TableCell>
              <TableCell className="text-right">{formatMoney(row.sellerPayable.toString(), currency)}</TableCell>
              <TableCell className="text-xs">
                {row.sellerLines.map((line) =>
                  line.purchaseDocument ? (
                    <Link
                      key={line.id}
                      href={`/purchases/bills/${line.purchaseDocument.id}`}
                      className="mr-2 underline underline-offset-4"
                    >
                      {line.purchaseDocument.number}
                      {line.billPayment ? ` · ${line.billPayment.number}` : ''}
                    </Link>
                  ) : null,
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
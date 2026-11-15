import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as settlement from '@/server/services/marketplace-settlement.service'

import { runSettlement, saveSeller } from './actions'

export const metadata: Metadata = { title: 'Marketplace settlements' }

export default async function SettlementsPage() {
  const ctx = await requireOrgContext('invoice:read')
  const [sellers, batches] = await Promise.all([
    settlement.listSellers(ctx),
    settlement.listBatches(ctx),
  ])
  const currency = ctx.organization.baseCurrency
  const todayStr = today(ctx.organization.timeZone)
  const monthStart = todayStr.slice(0, 8) + '01'

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
            <Input id="periodStart" name="periodStart" type="date" defaultValue={monthStart} />
          </div>
          <div>
            <Label htmlFor="periodEnd">To</Label>
            <Input id="periodEnd" name="periodEnd" type="date" defaultValue={todayStr} />
          </div>
        </div>
        <Button type="submit" size="sm">
          Run settlement
        </Button>
      </form>

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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
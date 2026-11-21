import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as dunning from '@/server/services/dunning.service'

import { sendDunningReminder } from './actions'

export const metadata: Metadata = { title: 'Subscription dunning' }

export default async function SubscriptionDunningPage() {
  const ctx = await requireOrgContext('invoice:read')
  const rows = await dunning.listOverdueSubscriptionInvoices(ctx)
  const currency = ctx.organization.baseCurrency
  const canRemind = ctx.permissions.has('invoice:create')

  return (
    <>
      <PageHeader
        title="Subscription dunning"
        description="Overdue invoices for customers on a recurring bill schedule."
        actions={
          <Link href="/sales/subscriptions" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            Schedules
          </Link>
        }
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead> </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No overdue subscription invoices.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/sales/invoices/${row.id}`} className="hover:underline">
                    {row.number}
                  </Link>
                </TableCell>
                <TableCell>
                  {row.customerName}
                  {row.customerEmail ? (
                    <span className="block text-xs text-muted-foreground">{row.customerEmail}</span>
                  ) : null}
                </TableCell>
                <TableCell>{row.dueDate ? formatDate(row.dueDate) : '—'}</TableCell>
                <TableCell className="text-right">{formatMoney(row.balance, currency)}</TableCell>
                <TableCell>
                  {canRemind && row.customerEmail ? (
                    <form action={sendDunningReminder}>
                      <input type="hidden" name="invoiceId" value={row.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Send reminder
                      </Button>
                    </form>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  )
}

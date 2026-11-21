import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as loan from '@/server/services/loan.service'

import { accrueLoanInterest, createLoanAccount, disburseLoan, postLoanDue } from './actions'

export const metadata: Metadata = { title: 'Loans' }

export default async function LoansPage() {
  const ctx = await requireOrgContext('customer:read')
  const [accounts, aging] = await Promise.all([loan.listAccounts(ctx), loan.overdueAging(ctx)])
  const currency = ctx.organization.baseCurrency
  const todayStr = today(ctx.organization.timeZone)
  const canPost = ctx.permissions.has('journal:post')

  return (
    <>
      <PageHeader
        title="Loans"
        description="Disburse to bank, post collections, accrue interest once, and age overdue instalments."
      />

      <form action={createLoanAccount} className="mb-6 grid max-w-lg gap-2 rounded-md border p-4">
        <p className="text-sm font-medium">New loan</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Customer id" name="customerId" required />
          <Field label="Principal" name="principal" defaultValue="10000" />
          <Field label="Annual rate %" name="annualRate" defaultValue="12" />
          <Field label="Term months" name="termMonths" type="number" defaultValue="12" />
          <Field label="Start date" name="startDate" type="date" defaultValue={todayStr} />
        </div>
        <Button type="submit" size="sm">
          Create &amp; schedule
        </Button>
      </form>

      {canPost ? (
        <div className="mb-8 flex flex-wrap gap-2">
          <form action={postLoanDue}>
            <Button type="submit" size="sm" variant="outline">
              Post due installments
            </Button>
          </form>
          <form action={accrueLoanInterest}>
            <Button type="submit" size="sm" variant="outline">
              Accrue interest
            </Button>
          </form>
        </div>
      ) : null}

      <h2 className="mb-2 text-sm font-medium">Accounts</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Principal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Disbursed</TableHead>
            <TableHead>Next due</TableHead>
            {canPost ? <TableHead>Bank account id</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((row: (typeof accounts)[number]) => {
            const next = row.schedule.find((line: (typeof row.schedule)[number]) => !line.paidAt)
            return (
              <TableRow key={row.id}>
                <TableCell>{row.customer.displayName}</TableCell>
                <TableCell className="text-right">{formatMoney(row.principal.toString(), currency)}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>{row.disbursementJournalId ? 'Yes' : 'No'}</TableCell>
                <TableCell>{next ? formatDate(next.dueDate.toISOString().slice(0, 10)) : '—'}</TableCell>
                {canPost ? (
                  <TableCell>
                    {row.disbursementJournalId ? (
                      '—'
                    ) : (
                      <form action={disburseLoan} className="flex gap-1">
                        <input type="hidden" name="loanAccountId" value={row.id} />
                        <Input name="bankAccountId" placeholder="Bank account id" className="h-8 w-40" required />
                        <Button type="submit" size="sm" variant="secondary">
                          Disburse
                        </Button>
                      </form>
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <h2 className="mb-2 mt-8 text-sm font-medium">Overdue aging</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">1–30</TableHead>
            <TableHead className="text-right">31–60</TableHead>
            <TableHead className="text-right">61–90</TableHead>
            <TableHead className="text-right">90+</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {aging.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.customerName}</TableCell>
              <TableCell className="text-right">{formatMoney(row.buckets['1-30'], currency)}</TableCell>
              <TableCell className="text-right">{formatMoney(row.buckets['31-60'], currency)}</TableCell>
              <TableCell className="text-right">{formatMoney(row.buckets['61-90'], currency)}</TableCell>
              <TableCell className="text-right">{formatMoney(row.buckets['90+'], currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  required?: boolean
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} />
    </div>
  )
}

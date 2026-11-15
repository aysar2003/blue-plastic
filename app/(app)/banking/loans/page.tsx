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

import { createLoanAccount, postLoanDue } from './actions'

export const metadata: Metadata = { title: 'Loans' }

export default async function LoansPage() {
  const ctx = await requireOrgContext('customer:read')
  const accounts = await loan.listAccounts(ctx)
  const currency = ctx.organization.baseCurrency
  const todayStr = today(ctx.organization.timeZone)

  return (
    <>
      <PageHeader title="Loans" description="Loan accounts, schedules, and due posting (Maaha lite)." />

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

      <form action={postLoanDue} className="mb-8">
        <Button type="submit" size="sm" variant="outline">
          Post due installments (as of today)
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Principal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Next due</TableHead>
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
                <TableCell>{next ? formatDate(next.dueDate.toISOString().slice(0, 10)) : '—'}</TableCell>
              </TableRow>
            )
          })}
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
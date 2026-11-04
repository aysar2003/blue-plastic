'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createEndOfService, deleteEndOfService, postEndOfService } from '../actions'

type Person = { id: string; name: string }
type Account = { id: string; label: string }
type Row = {
  id: string
  employeeName: string
  asOf: string
  years: string
  amount: string
  status: string
  journalNumber: string | null
  journalId: string | null
}

export function GratuityBoard({
  rows,
  people,
  accounts,
  canManage,
}: {
  rows: Row[]
  people: Person[]
  accounts: Account[]
  canManage: boolean
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [employeeId, setEmployeeId] = useState(people[0]?.id ?? '')
  const [asOf, setAsOf] = useState('')
  const [monthsPerYear, setMonthsPerYear] = useState('1')
  const [expenseAccountId, setExpenseAccountId] = useState('')
  const [payAccountId, setPayAccountId] = useState('')
  const [memo, setMemo] = useState('')

  function save() {
    startBusy(async () => {
      const result = await createEndOfService({
        employeeId,
        asOf,
        monthsPerYear: monthsPerYear.trim() || '1',
        expenseAccountId: expenseAccountId || null,
        payAccountId: payAccountId || null,
        memo: memo.trim() || null,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not calculate')
        return
      }
      toast.success('Gratuity drafted')
      router.refresh()
    })
  }

  function post(id: string) {
    startBusy(async () => {
      const result = await postEndOfService({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not post')
        return
      }
      toast.success(`Posted as ${result.data.journalNumber}`)
      router.refresh()
    })
  }

  function remove(id: string) {
    startBusy(async () => {
      const result = await deleteEndOfService({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not delete')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="grid max-w-5xl gap-6">
      <p className="text-sm text-muted-foreground">
        One month of wage for each year of service when the rate is 1. Uses the hire date and the wage on the employee card.
      </p>
      {canManage ? (
        <section className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
          <Field label="Employee">
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="As of">
            <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </Field>
          <Field label="Months of wage per year">
            <Input value={monthsPerYear} onChange={(e) => setMonthsPerYear(e.target.value)} />
          </Field>
          <Field label="Memo">
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} />
          </Field>
          <Field label="Expense account">
            <AccountSelect accounts={accounts} value={expenseAccountId} onChange={setExpenseAccountId} />
          </Field>
          <Field label="Payable or bank">
            <AccountSelect accounts={accounts} value={payAccountId} onChange={setPayAccountId} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="button" disabled={busy || !employeeId || !asOf} onClick={save}>
              Calculate draft
            </Button>
          </div>
        </section>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">As of</th>
              <th className="px-3 py-2 font-medium">Years</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No gratuity drafts.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{row.employeeName}</td>
                  <td className="px-3 py-2">{row.asOf}</td>
                  <td className="px-3 py-2">{row.years}</td>
                  <td className="px-3 py-2">{row.amount}</td>
                  <td className="px-3 py-2">
                    {row.status}
                    {row.journalId ? (
                      <div>
                        <Link href={`/journals/${row.journalId}`} className="text-xs text-primary hover:underline">
                          {row.journalNumber}
                        </Link>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canManage && row.status === 'DRAFT' ? (
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" disabled={busy} onClick={() => post(row.id)}>
                          Post
                        </Button>
                        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => remove(row.id)}>
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AccountSelect({ accounts, value, onChange }: { accounts: Account[]; value: string; onChange: (value: string) => void }) {
  return (
    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Employee default</option>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.label}
        </option>
      ))}
    </select>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

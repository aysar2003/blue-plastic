'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createPayrollRun, deletePayrollRun } from './actions'

type Run = {
  id: string
  periodStart: string
  periodEnd: string
  memo: string | null
  status: string
  payslipCount: number
  journalNumber: string | null
}

type Account = { id: string; label: string }

export function PayrollBoard({
  runs,
  accounts,
  canManage,
}: {
  runs: Run[]
  accounts: Account[]
  canManage: boolean
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [memo, setMemo] = useState('')
  const [payFromAccountId, setPayFromAccountId] = useState('')

  function create() {
    startBusy(async () => {
      const result = await createPayrollRun({
        periodStart,
        periodEnd,
        memo: memo.trim() || null,
        payFromAccountId: payFromAccountId || null,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not create run')
        return
      }
      toast.success('Payroll run created')
      router.push(`/employees/payroll/${result.data.id}`)
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!window.confirm('Delete this draft payroll run?')) return
    startBusy(async () => {
      const result = await deletePayrollRun({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not delete')
        return
      }
      toast.success('Deleted')
      router.refresh()
    })
  }

  return (
    <div className="grid max-w-5xl gap-6">
      {canManage ? (
        <section className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
          <Field label="Period start">
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </Field>
          <Field label="Period end">
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </Field>
          <Field label="Pay from account">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={payFromAccountId}
              onChange={(e) => setPayFromAccountId(e.target.value)}
            >
              <option value="">Select later…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Memo">
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="button" disabled={busy || !periodStart || !periodEnd} onClick={create}>
              {busy ? 'Creating…' : 'Create draft run'}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Builds payslips for active employees with a wage. Set wage + expense account on each employee card.
            </p>
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Period</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Payslips</th>
              <th className="px-3 py-2 font-medium">Journal</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No payroll runs yet.
                </td>
              </tr>
            ) : (
              runs.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/employees/payroll/${row.id}`} className="font-medium text-primary hover:underline">
                      {row.periodStart} → {row.periodEnd}
                    </Link>
                    {row.memo ? <div className="text-xs text-muted-foreground">{row.memo}</div> : null}
                  </td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.payslipCount}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.journalNumber ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {canManage && row.status === 'DRAFT' ? (
                      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => remove(row.id)}>
                        Delete
                      </Button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

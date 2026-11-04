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
  awaitingApproval?: boolean
  payMode?: string
}

type Person = { id: string; name: string }

type Account = { id: string; label: string }

export function PayrollBoard({
  runs,
  accounts,
  canManage,
  standard = false,
  people = [],
}: {
  runs: Run[]
  accounts: Account[]
  canManage: boolean
  standard?: boolean
  people?: Person[]
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [memo, setMemo] = useState('')
  const [payFromAccountId, setPayFromAccountId] = useState('')
  const [liabilityAccountId, setLiabilityAccountId] = useState('')
  const [payMode, setPayMode] = useState<'IMMEDIATE' | 'ACCRUE'>('IMMEDIATE')
  const [offCycle, setOffCycle] = useState(false)
  const [employeeIds, setEmployeeIds] = useState<string[]>([])

  function create() {
    startBusy(async () => {
      const result = await createPayrollRun({
        periodStart,
        periodEnd,
        memo: memo.trim() || null,
        payFromAccountId: payFromAccountId || null,
        liabilityAccountId: liabilityAccountId || null,
        payMode,
        employeeIds: offCycle ? employeeIds : [],
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not create run')
        return
      }
      const warnings = result.data.warnings ?? []
      if (warnings.length) toast.warning(warnings.slice(0, 3).join(' '))
      toast.success('Payroll run created')
      router.push(`/employees/payroll/${result.data.id}`)
      router.refresh()
    })
  }

  function remove(id: string, status: string) {
    const ok =
      status === 'DRAFT'
        ? window.confirm('Delete this draft payroll run?')
        : window.confirm(
            'Delete this posted payroll? The journal leaves the ledger and the run returns to draft.',
          )
    if (!ok) return
    startBusy(async () => {
      const result = await deletePayrollRun({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not delete')
        return
      }
      toast.success(status === 'POSTED' ? 'Journal withdrawn — run is draft again' : 'Deleted')
      router.refresh()
    })
  }

  return (
    <div className="grid max-w-5xl gap-6">
      {standard ? (
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/employees/payroll/structures" className="text-primary hover:underline">
            Salary structures
          </Link>
          <Link href="/employees/payroll/advances" className="text-primary hover:underline">
            Loans & advances
          </Link>
          <Link href="/employees/payroll/gratuity" className="text-primary hover:underline">
            End of service
          </Link>
          <Link href="/employees/payroll/report" className="text-primary hover:underline">
            Report
          </Link>
          <Link href="/employees/payroll/mine" className="text-primary hover:underline">
            My payslips
          </Link>
        </div>
      ) : null}
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
          {standard ? (
            <>
              <Field label="How to pay">
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as 'IMMEDIATE' | 'ACCRUE')}
                >
                  <option value="IMMEDIATE">Pay now (bank, cash, or mobile)</option>
                  <option value="ACCRUE">Accrue wages payable, pay later</option>
                </select>
              </Field>
              <Field label="Deduction liability">
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={liabilityAccountId}
                  onChange={(e) => setLiabilityAccountId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={offCycle} onChange={(e) => setOffCycle(e.target.checked)} />
                Off-cycle — only the people I tick
              </label>
              {offCycle ? (
                <div className="grid max-h-40 gap-1 overflow-auto rounded-md border border-border p-2 sm:col-span-2">
                  {people.map((person) => (
                    <label key={person.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={employeeIds.includes(person.id)}
                        onChange={(e) =>
                          setEmployeeIds((current) =>
                            e.target.checked
                              ? [...current, person.id]
                              : current.filter((id) => id !== person.id),
                          )
                        }
                      />
                      {person.name}
                    </label>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
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
                  <td className="px-3 py-2">
                    {row.awaitingApproval && row.status === 'DRAFT' ? 'PENDING' : row.status}
                    {row.payMode === 'ACCRUE' ? (
                      <div className="text-xs text-muted-foreground">Accrue</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.payslipCount}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.journalNumber ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {canManage ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => remove(row.id, row.status)}
                      >
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

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  addEmployeesToPayrollRun,
  addPayslipAdjustment,
  deletePayrollRun,
  emailPayslip,
  postPayrollRun,
  recomputePayrollRun,
  removePayslipLine,
  setPayslipAttendance,
  setPayslipIncluded,
  settlePayrollRun,
  submitPayrollRun,
} from '../actions'

type SlipLine = {
  id: string
  code: string
  label: string
  amount: string
  kind: string
}

type Slip = {
  id: string
  number?: string | null
  included?: boolean
  employeeId?: string
  employeeName: string
  department: string | null
  payMethod?: string
  workedDaysOverride?: number | null
  workedHoursOverride?: string | null
  overtimeAmountOverride?: string | null
  gross: string
  deductions: string
  employer?: string
  net: string
  ytdGross?: string
  ytdNet?: string
  lines: SlipLine[]
}

type Account = { id: string; label: string }
type Person = { id: string; name: string; department: string | null }

export function PayrollDetail({
  run,
  accounts,
  addablePeople = [],
  canManage,
  standard = false,
}: {
  run: {
    id: string
    periodStart: string
    periodEnd: string
    status: string
    payFromAccountId: string | null
    liabilityAccountId?: string | null
    payMode?: string
    awaitingApproval?: boolean
    journalNumber: string | null
    journalId: string | null
    settlementJournalId?: string | null
    settlementJournalNumber?: string | null
    paymentSummary?: { method: string; count: number; net: string }[]
    payslips: Slip[]
  }
  accounts: Account[]
  addablePeople?: Person[]
  canManage: boolean
  standard?: boolean
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [payFromAccountId, setPayFromAccountId] = useState(run.payFromAccountId ?? '')
  const [liabilityAccountId, setLiabilityAccountId] = useState(run.liabilityAccountId ?? '')
  const [payMode, setPayMode] = useState(run.payMode === 'ACCRUE' ? 'ACCRUE' : 'IMMEDIATE')
  const [date, setDate] = useState(run.periodEnd)
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [adjKind, setAdjKind] = useState<'EARNING' | 'DEDUCTION'>('EARNING')
  const [adjLabel, setAdjLabel] = useState('Bonus')
  const [adjAmount, setAdjAmount] = useState('')
  const [attendanceEdit, setAttendanceEdit] = useState<string | null>(null)
  const [daysOverride, setDaysOverride] = useState('')
  const [hoursOverride, setHoursOverride] = useState('')
  const [otOverride, setOtOverride] = useState('')
  const [addingPeople, setAddingPeople] = useState(false)
  const [pickedIds, setPickedIds] = useState<string[]>([])

  const totalNet = run.payslips.reduce((sum, s) => sum + (s.included === false ? 0 : Number(s.net)), 0)
  const draft = run.status === 'DRAFT'
  const pending = Boolean(run.awaitingApproval) && draft
  const posted = run.status === 'POSTED'
  const accruedUnpaid = posted && run.payMode === 'ACCRUE' && !run.settlementJournalId
  const settled = Boolean(run.settlementJournalId)

  function addPeople() {
    if (pickedIds.length === 0) return
    startBusy(async () => {
      const result = await addEmployeesToPayrollRun({ id: run.id, employeeIds: pickedIds })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not add employees')
        return
      }
      for (const warning of result.data.warnings ?? []) toast.message(warning)
      toast.success('Employees added')
      setPickedIds([])
      setAddingPeople(false)
      router.refresh()
    })
  }

  function post() {
    startBusy(async () => {
      const result = await postPayrollRun({
        id: run.id,
        payFromAccountId: payFromAccountId || null,
        liabilityAccountId: liabilityAccountId || null,
        payMode,
        date,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not post')
        return
      }
      toast.success(`Posted as ${result.data.journalNumber}`)
      router.refresh()
    })
  }

  function submit() {
    startBusy(async () => {
      const result = await submitPayrollRun({
        id: run.id,
        payFromAccountId: payFromAccountId || null,
        liabilityAccountId: liabilityAccountId || null,
        payMode,
        date,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not submit')
        return
      }
      toast.success('Submitted for approval')
      router.refresh()
    })
  }

  function settle() {
    startBusy(async () => {
      const result = await settlePayrollRun({
        id: run.id,
        payFromAccountId: payFromAccountId || null,
        date,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not pay wages')
        return
      }
      toast.success(`Paid as ${result.data.journalNumber}`)
      router.refresh()
    })
  }

  function recompute() {
    startBusy(async () => {
      const result = await recomputePayrollRun({ id: run.id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not recompute')
        return
      }
      const warnings = result.data.warnings ?? []
      if (warnings.length) toast.warning(warnings.slice(0, 3).join(' '))
      toast.success('Payslips recomputed')
      router.refresh()
    })
  }

  function toggleIncluded(payslipId: string, included: boolean) {
    startBusy(async () => {
      const result = await setPayslipIncluded({ payslipId, included })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not update')
        return
      }
      router.refresh()
    })
  }

  function sendEmail(payslipId: string) {
    startBusy(async () => {
      const result = await emailPayslip({ id: payslipId })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not email')
        return
      }
      toast.success(`Sent to ${result.data.to}`)
    })
  }

  function remove() {
    const ok = draft
      ? window.confirm('Delete this draft payroll run?')
      : window.confirm(
          'Delete this posted payroll? The journal leaves the ledger and the run returns to draft.',
        )
    if (!ok) return
    startBusy(async () => {
      const result = await deletePayrollRun({ id: run.id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not delete')
        return
      }
      toast.success(draft ? 'Deleted' : 'Journal withdrawn — run is draft again')
      if (draft) router.push('/employees/payroll')
      router.refresh()
    })
  }

  function openAdjust(slipId: string) {
    setAdjusting(slipId)
    setAttendanceEdit(null)
    setAdjKind('EARNING')
    setAdjLabel('Bonus')
    setAdjAmount('')
  }

  function openAttendance(slip: Slip) {
    setAttendanceEdit(slip.id)
    setAdjusting(null)
    setDaysOverride(slip.workedDaysOverride != null ? String(slip.workedDaysOverride) : '')
    setHoursOverride(slip.workedHoursOverride ?? '')
    setOtOverride(slip.overtimeAmountOverride ?? '')
  }

  function saveAttendance() {
    if (!attendanceEdit) return
    startBusy(async () => {
      const result = await setPayslipAttendance({
        payslipId: attendanceEdit,
        workedDaysOverride: daysOverride.trim() === '' ? null : Number(daysOverride),
        workedHoursOverride: hoursOverride.trim() === '' ? null : hoursOverride.trim(),
        overtimeAmountOverride: otOverride.trim() === '' ? null : otOverride.trim(),
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not save attendance')
        return
      }
      toast.success('Attendance overrides saved')
      setAttendanceEdit(null)
      router.refresh()
    })
  }

  function saveAdjust() {
    if (!adjusting) return
    startBusy(async () => {
      const result = await addPayslipAdjustment({
        payslipId: adjusting,
        kind: adjKind,
        label: adjLabel.trim() || (adjKind === 'EARNING' ? 'Bonus' : 'Deduction'),
        amount: adjAmount.trim() || '0',
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not add adjustment')
        return
      }
      toast.success(adjKind === 'EARNING' ? 'Bonus added' : 'Deduction added')
      setAdjusting(null)
      router.refresh()
    })
  }

  function removeLine(lineId: string) {
    startBusy(async () => {
      const result = await removePayslipLine({ id: lineId })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not remove line')
        return
      }
      toast.success('Line removed')
      router.refresh()
    })
  }

  return (
    <div className="grid max-w-5xl gap-6">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          {run.periodStart} → {run.periodEnd} ·{' '}
          {pending ? 'PENDING APPROVAL' : settled ? 'POSTED · PAID' : run.status}
          {run.journalNumber ? (
            <>
              {' '}
              · Journal{' '}
              {run.journalId ? (
                <Link href={`/journals/${run.journalId}`} className="text-primary hover:underline">
                  {run.journalNumber}
                </Link>
              ) : (
                run.journalNumber
              )}
            </>
          ) : null}
          {run.settlementJournalNumber ? (
            <>
              {' '}
              · Paid{' '}
              {run.settlementJournalId ? (
                <Link
                  href={`/journals/${run.settlementJournalId}`}
                  className="text-primary hover:underline"
                >
                  {run.settlementJournalNumber}
                </Link>
              ) : (
                run.settlementJournalNumber
              )}
            </>
          ) : null}
        </span>
        {canManage ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={remove}>
            Delete
          </Button>
        ) : null}
      </div>

      {standard && run.paymentSummary && run.paymentSummary.length > 0 ? (
        <section className="rounded-lg border border-border p-4 text-sm">
          <p className="mb-2 font-medium">Payment batch</p>
          <div className="flex flex-wrap gap-4 text-muted-foreground">
            {run.paymentSummary.map((row) => (
              <span key={row.method}>
                {row.method}: {row.count} · {Number(row.net).toFixed(2)}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {canManage && draft ? (
        <section className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3">
          <Field label="Pay from">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={payFromAccountId}
              onChange={(e) => setPayFromAccountId(e.target.value)}
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Posting date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {standard ? (
            <>
              <Field label="How to pay">
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                >
                  <option value="IMMEDIATE">Pay now</option>
                  <option value="ACCRUE">Accrue payable</option>
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
            </>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            {standard ? (
              <Button type="button" variant="outline" disabled={busy} onClick={recompute}>
                Recompute
              </Button>
            ) : null}
            {standard && !pending ? (
              <Button type="button" disabled={busy} onClick={submit}>
                Submit for approval
              </Button>
            ) : (
              <Button
                type="button"
                disabled={busy || (!payFromAccountId && payMode === 'IMMEDIATE')}
                onClick={post}
              >
                {busy ? 'Posting…' : `${pending ? 'Approve & post' : 'Post payroll'} (${totalNet.toFixed(2)})`}
              </Button>
            )}
          </div>
        </section>
      ) : null}

      {canManage && accruedUnpaid ? (
        <section className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3">
          <Field label="Pay from">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={payFromAccountId}
              onChange={(e) => setPayFromAccountId(e.target.value)}
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="button" disabled={busy || !payFromAccountId} onClick={settle}>
              {busy ? 'Paying…' : `Pay wages now (${totalNet.toFixed(2)})`}
            </Button>
          </div>
        </section>
      ) : null}

      {canManage && standard && draft && addablePeople.length > 0 ? (
        <section className="rounded-lg border border-border p-4 text-sm">
          {!addingPeople ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setAddingPeople(true)}>
              Add employees
            </Button>
          ) : (
            <div className="grid gap-3">
              <p className="font-medium">Add to this draft</p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {addablePeople.map((person) => (
                  <label key={person.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={pickedIds.includes(person.id)}
                      disabled={busy}
                      onChange={(e) =>
                        setPickedIds((prev) =>
                          e.target.checked ? [...prev, person.id] : prev.filter((id) => id !== person.id),
                        )
                      }
                    />
                    <span>
                      {person.name}
                      {person.department ? (
                        <span className="text-muted-foreground"> · {person.department}</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={busy || pickedIds.length === 0} onClick={addPeople}>
                  {busy ? 'Adding…' : `Add (${pickedIds.length})`}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setAddingPeople(false)
                    setPickedIds([])
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {canManage && draft && adjusting ? (
        <section className="grid gap-3 rounded-lg border border-primary/30 bg-muted/20 p-4 sm:grid-cols-4">
          <Field label="Type">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={adjKind}
              onChange={(e) => {
                const kind = e.target.value as 'EARNING' | 'DEDUCTION'
                setAdjKind(kind)
                setAdjLabel(kind === 'EARNING' ? 'Bonus' : 'Deduction')
              }}
            >
              <option value="EARNING">Bonus / earning</option>
              <option value="DEDUCTION">Deduction</option>
            </select>
          </Field>
          <Field label="Label">
            <Input value={adjLabel} onChange={(e) => setAdjLabel(e.target.value)} placeholder="Bonus" />
          </Field>
          <Field label="Amount">
            <Input value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} placeholder="0.00" />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="button" disabled={busy || !adjAmount.trim()} onClick={saveAdjust}>
              {busy ? 'Saving…' : 'Add'}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setAdjusting(null)}>
              Cancel
            </Button>
          </div>
        </section>
      ) : null}

      {canManage && draft && attendanceEdit ? (
        <section className="grid gap-3 rounded-lg border border-primary/30 bg-muted/20 p-4 sm:grid-cols-4">
          <Field label="Worked days">
            <Input
              value={daysOverride}
              onChange={(e) => setDaysOverride(e.target.value)}
              placeholder="Attendance"
            />
          </Field>
          <Field label="Worked hours">
            <Input
              value={hoursOverride}
              onChange={(e) => setHoursOverride(e.target.value)}
              placeholder="Attendance"
            />
          </Field>
          <Field label="Overtime amount">
            <Input
              value={otOverride}
              onChange={(e) => setOtOverride(e.target.value)}
              placeholder="Calculated"
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="button" disabled={busy} onClick={saveAttendance}>
              {busy ? 'Saving…' : 'Save & recompute'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setAttendanceEdit(null)}
            >
              Cancel
            </Button>
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Gross</th>
              <th className="px-3 py-2 font-medium">Deductions</th>
              <th className="px-3 py-2 font-medium">Net</th>
              <th className="px-3 py-2 font-medium">Lines</th>
              {canManage && draft ? <th className="px-3 py-2 font-medium">Adjust</th> : null}
            </tr>
          </thead>
          <tbody>
            {run.payslips.map((slip) => (
              <tr key={slip.id} className="border-b border-border last:border-0 align-top">
                <td className="px-3 py-2">
                  {standard && draft ? (
                    <label className="mr-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="mr-1"
                        checked={slip.included !== false}
                        disabled={busy}
                        onChange={(e) => toggleIncluded(slip.id, e.target.checked)}
                      />
                      Pay
                    </label>
                  ) : null}
                  {slip.employeeName}
                  {slip.number ? <div className="text-xs text-muted-foreground">{slip.number}</div> : null}
                  {slip.department ? (
                    <div className="text-xs text-muted-foreground">{slip.department}</div>
                  ) : null}
                  {slip.payMethod ? (
                    <div className="text-xs text-muted-foreground">{slip.payMethod}</div>
                  ) : null}
                  {slip.ytdNet ? (
                    <div className="text-xs text-muted-foreground">
                      YTD net {Number(slip.ytdNet).toFixed(2)}
                    </div>
                  ) : null}
                  <div className="mt-1 flex gap-2 text-xs">
                    <a
                      className="text-primary hover:underline"
                      href={`/api/payroll/payslips/${slip.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      PDF
                    </a>
                    <a
                      className="text-primary hover:underline"
                      href={`/api/payroll/payslips/${slip.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        e.preventDefault()
                        const win = window.open(`/api/payroll/payslips/${slip.id}/pdf`, '_blank')
                        if (win) win.addEventListener('load', () => win.print())
                      }}
                    >
                      Print
                    </a>
                    {canManage ? (
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        disabled={busy}
                        onClick={() => sendEmail(slip.id)}
                        title="Requires work email on the employee card"
                      >
                        Email
                      </button>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">{Number(slip.gross).toFixed(2)}</td>
                <td className="px-3 py-2">{Number(slip.deductions).toFixed(2)}</td>
                <td className="px-3 py-2 font-medium">{Number(slip.net).toFixed(2)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {slip.lines.map((line) => {
                    const removable =
                      canManage &&
                      draft &&
                      line.code !== 'SALARY' &&
                      line.code !== 'WAGE' &&
                      line.code !== 'UNPAID_LEAVE'
                    return (
                      <div key={line.id} className="flex flex-wrap items-center gap-2">
                        <span>
                          {line.kind === 'DEDUCTION' ? '−' : '+'} {line.label}:{' '}
                          {Number(line.amount).toFixed(2)}
                        </span>
                        {removable ? (
                          <button
                            type="button"
                            className="text-destructive underline-offset-2 hover:underline disabled:opacity-50"
                            disabled={busy}
                            onClick={() => removeLine(line.id)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </td>
                {canManage && draft ? (
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => openAdjust(slip.id)}
                      >
                        Bonus / deduction
                      </Button>
                      {standard ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => openAttendance(slip)}
                        >
                          Days / hours / OT
                        </Button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

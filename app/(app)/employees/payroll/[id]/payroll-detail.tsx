'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addPayslipAdjustment, postPayrollRun, removePayslipLine } from '../actions'

type SlipLine = {
  id: string
  code: string
  label: string
  amount: string
  kind: string
}

type Slip = {
  id: string
  employeeName: string
  department: string | null
  gross: string
  deductions: string
  net: string
  lines: SlipLine[]
}

type Account = { id: string; label: string }

export function PayrollDetail({
  run,
  accounts,
  canManage,
}: {
  run: {
    id: string
    periodStart: string
    periodEnd: string
    status: string
    payFromAccountId: string | null
    journalNumber: string | null
    journalId: string | null
    payslips: Slip[]
  }
  accounts: Account[]
  canManage: boolean
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [payFromAccountId, setPayFromAccountId] = useState(run.payFromAccountId ?? '')
  const [date, setDate] = useState(run.periodEnd)
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [adjKind, setAdjKind] = useState<'EARNING' | 'DEDUCTION'>('EARNING')
  const [adjLabel, setAdjLabel] = useState('Bonus')
  const [adjAmount, setAdjAmount] = useState('')

  const totalNet = run.payslips.reduce((sum, s) => sum + Number(s.net), 0)
  const draft = run.status === 'DRAFT'

  function post() {
    startBusy(async () => {
      const result = await postPayrollRun({
        id: run.id,
        payFromAccountId: payFromAccountId || null,
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

  function openAdjust(slipId: string) {
    setAdjusting(slipId)
    setAdjKind('EARNING')
    setAdjLabel('Bonus')
    setAdjAmount('')
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
      <div className="text-sm text-muted-foreground">
        {run.periodStart} → {run.periodEnd} · {run.status}
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
      </div>

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
          <div className="flex items-end">
            <Button type="button" disabled={busy || !payFromAccountId} onClick={post}>
              {busy ? 'Posting…' : `Post payroll (${totalNet.toFixed(2)})`}
            </Button>
          </div>
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
                  {slip.employeeName}
                  {slip.department ? (
                    <div className="text-xs text-muted-foreground">{slip.department}</div>
                  ) : null}
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
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => openAdjust(slip.id)}
                    >
                      Bonus / deduction
                    </Button>
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

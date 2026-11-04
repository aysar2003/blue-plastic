'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { closeAdvance, createAdvance } from '../actions'

type Person = { id: string; name: string }
type Account = { id: string; label: string }
type Row = {
  id: string
  employeeName: string
  kind: string
  label: string
  principal: string
  balance: string
  installment: string
  active: boolean
}

export function AdvancesBoard({
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
  const [kind, setKind] = useState<'LOAN' | 'ADVANCE'>('ADVANCE')
  const [label, setLabel] = useState('Salary advance')
  const [amount, setAmount] = useState('')
  const [installment, setInstallment] = useState('')
  const [accountId, setAccountId] = useState('')

  function save() {
    startBusy(async () => {
      const result = await createAdvance({
        employeeId,
        kind,
        label,
        amount: amount.trim() || '0',
        installment: installment.trim() || '0',
        accountId: accountId || null,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not save')
        return
      }
      toast.success('Saved. The next payroll recovers the installment.')
      setAmount('')
      setInstallment('')
      router.refresh()
    })
  }

  function close(id: string) {
    startBusy(async () => {
      const result = await closeAdvance({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not close')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="grid max-w-5xl gap-6">
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
          <Field label="Kind">
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="ADVANCE">Advance</option>
              <option value="LOAN">Loan</option>
            </select>
          </Field>
          <Field label="Label">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Field label="Balance account">
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Run liability account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Installment each run">
            <Input value={installment} onChange={(e) => setInstallment(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="button" disabled={busy || !employeeId} onClick={save}>
              Save
            </Button>
          </div>
        </section>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium">Balance</th>
              <th className="px-3 py-2 font-medium">Installment</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No loans or advances.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    {row.employeeName}
                    <div className="text-xs text-muted-foreground">{row.kind}</div>
                  </td>
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2">
                    {row.balance}
                    <div className="text-xs text-muted-foreground">of {row.principal}</div>
                  </td>
                  <td className="px-3 py-2">{row.installment}</td>
                  <td className="px-3 py-2 text-right">
                    {canManage && row.active ? (
                      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => close(row.id)}>
                        Close
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Closed</span>
                    )}
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
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  addStructureRule,
  createSalaryStructure,
  removeStructureRule,
  updateStructureRule,
} from '../actions'

type Slab = { upTo: string | null; rate: string }

type Rule = {
  id: string
  code: string
  name: string
  kind: string
  calc: string
  amount: string
  slabs?: Slab[] | null
}

type Structure = { id: string; name: string; rules: Rule[] }
type Account = { id: string; label: string }

function slabsToText(slabs: Slab[] | null | undefined) {
  if (!slabs?.length) return ''
  return slabs.map((row) => `${row.upTo ?? '*'}:${row.rate}`).join('\n')
}

function textToSlabs(text: string): Slab[] {
  return text
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [upRaw, rateRaw] = line.split(':').map((part) => part.trim())
      const upTo = !upRaw || upRaw === '*' ? null : upRaw
      return { upTo, rate: rateRaw || '0' }
    })
    .filter((row) => Number.isFinite(Number(row.rate)))
}

export function StructuresBoard({
  structures,
  accounts,
  canManage,
}: {
  structures: Structure[]
  accounts: Account[]
  canManage: boolean
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [structureId, setStructureId] = useState(structures[0]?.id ?? '')
  const structure = structures.find((row) => row.id === structureId) ?? structures[0]
  const [newName, setNewName] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'EARNING' | 'DEDUCTION' | 'EMPLOYER'>('EARNING')
  const [calc, setCalc] = useState<'BASE' | 'FIXED' | 'PERCENT' | 'SLABS'>('FIXED')
  const [amount, setAmount] = useState('0')
  const [slabsText, setSlabsText] = useState('500:0\n1000:10\n*:20')
  const [expenseAccountId, setExpenseAccountId] = useState('')
  const [liabilityAccountId, setLiabilityAccountId] = useState('')
  const [editAmount, setEditAmount] = useState<Record<string, string>>({})
  const [editSlabs, setEditSlabs] = useState<Record<string, string>>({})

  function create() {
    startBusy(async () => {
      const result = await createSalaryStructure({
        name: newName.trim(),
        cloneFromId: structure?.id ?? null,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not create structure')
        return
      }
      toast.success('Structure created')
      setNewName('')
      setStructureId(result.data.id)
      router.refresh()
    })
  }

  function add() {
    if (!structure) return
    startBusy(async () => {
      const result = await addStructureRule({
        structureId: structure.id,
        code,
        name,
        kind,
        calc,
        amount: amount.trim() || '0',
        slabs: calc === 'SLABS' ? textToSlabs(slabsText) : null,
        expenseAccountId: expenseAccountId || null,
        liabilityAccountId: liabilityAccountId || null,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not add component')
        return
      }
      toast.success('Component added')
      setCode('')
      setName('')
      router.refresh()
    })
  }

  function remove(id: string) {
    startBusy(async () => {
      const result = await removeStructureRule({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not remove')
        return
      }
      router.refresh()
    })
  }

  function saveAmount(rule: Rule) {
    startBusy(async () => {
      const result =
        rule.calc === 'SLABS'
          ? await updateStructureRule({
              id: rule.id,
              slabs: textToSlabs(editSlabs[rule.id] ?? slabsToText(rule.slabs)),
            })
          : await updateStructureRule({
              id: rule.id,
              amount: (editAmount[rule.id] ?? rule.amount).trim() || '0',
            })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not update')
        return
      }
      toast.success('Saved')
      setEditAmount((prev) => {
        const copy = { ...prev }
        delete copy[rule.id]
        return copy
      })
      setEditSlabs((prev) => {
        const copy = { ...prev }
        delete copy[rule.id]
        return copy
      })
      router.refresh()
    })
  }

  if (!structure) return null

  return (
    <div className="grid max-w-5xl gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Structure">
          <select
            className="flex h-9 min-w-[12rem] rounded-md border border-input bg-transparent px-3 text-sm"
            value={structure.id}
            onChange={(e) => setStructureId(e.target.value)}
          >
            {structures.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        {canManage ? (
          <>
            <Field label="New structure">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Factory"
              />
            </Field>
            <Button type="button" disabled={busy || !newName.trim()} onClick={create}>
              Create (copy current)
            </Button>
          </>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Assign {structure.name} on the employee card. Basic uses the wage. Percent and slabs are of
        basic. Slabs use lines like <code>500:0</code>, <code>1000:10</code>, <code>*:20</code>.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Calc</th>
              <th className="px-3 py-2 font-medium">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {structure.rules.map((rule) => (
              <tr key={rule.id} className="border-b border-border last:border-0 align-top">
                <td className="px-3 py-2">{rule.code}</td>
                <td className="px-3 py-2">{rule.name}</td>
                <td className="px-3 py-2">{rule.kind}</td>
                <td className="px-3 py-2">{rule.calc}</td>
                <td className="px-3 py-2">
                  {canManage && rule.calc === 'SLABS' ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        className="min-h-[4.5rem] w-48 rounded-md border border-input bg-transparent px-2 py-1 font-mono text-xs"
                        value={editSlabs[rule.id] ?? slabsToText(rule.slabs)}
                        onChange={(e) =>
                          setEditSlabs((prev) => ({ ...prev, [rule.id]: e.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => saveAmount(rule)}
                      >
                        Save
                      </Button>
                    </div>
                  ) : canManage && rule.calc !== 'BASE' ? (
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-8 w-24"
                        value={editAmount[rule.id] ?? Number(rule.amount).toFixed(2)}
                        onChange={(e) =>
                          setEditAmount((prev) => ({ ...prev, [rule.id]: e.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => saveAmount(rule)}
                      >
                        Save
                      </Button>
                    </div>
                  ) : rule.calc === 'SLABS' ? (
                    <span className="font-mono text-xs whitespace-pre-wrap">
                      {slabsToText(rule.slabs) || '—'}
                    </span>
                  ) : (
                    Number(rule.amount).toFixed(2)
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {canManage && rule.calc !== 'BASE' && rule.code !== 'TAX' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => remove(rule.id)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canManage ? (
        <section className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
          <Field label="Code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PENSION" />
          </Field>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pension" />
          </Field>
          <Field label="Kind">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="EARNING">Earning</option>
              <option value="DEDUCTION">Deduction</option>
              <option value="EMPLOYER">Employer cost</option>
            </select>
          </Field>
          <Field label="Calculation">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={calc}
              onChange={(e) => setCalc(e.target.value as typeof calc)}
            >
              <option value="FIXED">Fixed amount</option>
              <option value="PERCENT">Percent of basic</option>
              <option value="SLABS">Tax slabs</option>
            </select>
          </Field>
          {calc === 'SLABS' ? (
            <div className="sm:col-span-2">
              <Field label="Brackets (upTo:rate per line)">
                <textarea
                  className="min-h-[5rem] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm"
                  value={slabsText}
                  onChange={(e) => setSlabsText(e.target.value)}
                />
              </Field>
            </div>
          ) : (
            <Field label={calc === 'PERCENT' ? 'Percent' : 'Amount'}>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          )}
          <Field label="Expense account">
            <AccountSelect accounts={accounts} value={expenseAccountId} onChange={setExpenseAccountId} />
          </Field>
          <Field label="Liability account">
            <AccountSelect
              accounts={accounts}
              value={liabilityAccountId}
              onChange={setLiabilityAccountId}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="button" disabled={busy || !code.trim() || !name.trim()} onClick={add}>
              Add component
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function AccountSelect({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <select
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
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

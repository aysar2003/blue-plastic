'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { MONTHS } from '@/lib/constants'
import { formatMoney } from '@/lib/money'
import {
  approveBudget,
  collapseBudgetToFirstMonth,
  copyBudget,
  createBudget,
  deleteBudgetLine,
  importBudgetCsv,
  reviseBudget,
  spreadBudgetEvenly,
  upsertBudgetLine,
} from './actions'

type Account = { id: string; code: string; name: string }
type ClassRow = { id: string; name: string }

export function CreateBudgetForm({ classes }: { classes: ClassRow[] }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <form
      className="mb-8 grid max-w-xl gap-3 rounded-md border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        setError(null)
        start(async () => {
          const result = await createBudget({
            name: String(fd.get('name') ?? ''),
            startDate: String(fd.get('startDate') ?? ''),
            endDate: String(fd.get('endDate') ?? ''),
            notes: String(fd.get('notes') ?? '') || null,
            trackingCategoryId: String(fd.get('trackingCategoryId') ?? '') || null,
          })
          if (result && 'ok' in result && !result.ok) setError(result.error.message)
        })
      }}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="FY 2026 operating" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">End</Label>
          <Input id="endDate" name="endDate" type="date" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="trackingCategoryId">Fund / class (optional)</Label>
        <NativeSelect id="trackingCategoryId" name="trackingCategoryId" defaultValue="">
          <option value="">None</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" placeholder="Optional" />
      </div>
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? 'Creating…' : 'Create budget'}
      </Button>
    </form>
  )
}

export function BudgetToolbar({
  budgetId,
  status,
  currency,
}: {
  budgetId: string
  status: string
  currency: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  void currency

  function run(label: string, fn: () => Promise<unknown>) {
    setError(null)
    start(async () => {
      const result = await fn()
      if (result && typeof result === 'object' && 'ok' in result && !(result as { ok: boolean }).ok) {
        setError((result as { error: { message: string } }).error.message)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
      {status === 'DRAFT' ? (
        <>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => run('approve', () => approveBudget({ id: budgetId }))}
          >
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run('collapse', () => collapseBudgetToFirstMonth({ id: budgetId }))}
          >
            Collapse to first month
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run('spread', () => spreadBudgetEvenly({ id: budgetId }))}
          >
            Spread evenly
          </Button>
        </>
      ) : null}
      {status === 'APPROVED' || status === 'DRAFT' ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run('revise', () => reviseBudget({ id: budgetId }))}
        >
          Revise (new draft)
        </Button>
      ) : null}
    </div>
  )
}

export function UpsertLineForm({
  budgetId,
  accounts,
  classes,
  months,
  canEdit,
}: {
  budgetId: string
  accounts: Account[]
  classes: ClassRow[]
  months: number[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (!canEdit) return null

  return (
    <form
      className="mb-6 flex flex-wrap items-end gap-3 rounded-md border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        setError(null)
        start(async () => {
          const result = await upsertBudgetLine({
            budgetId,
            accountId: String(fd.get('accountId') ?? ''),
            month: Number(fd.get('month')),
            amount: String(fd.get('amount') ?? ''),
            trackingCategoryId: String(fd.get('trackingCategoryId') ?? '') || null,
          })
          if (!result.ok) {
            setError(result.error.message)
            return
          }
          e.currentTarget.reset()
          router.refresh()
        })
      }}
    >
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="accountId">Account</Label>
        <NativeSelect id="accountId" name="accountId" className="w-72" required defaultValue="">
          <option value="" disabled>
            Choose account
          </option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.code} {account.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="month">Month</Label>
        <NativeSelect id="month" name="month" className="w-36" required defaultValue={String(months[0] ?? 1)}>
          {months.map((m) => (
            <option key={m} value={m}>
              {MONTHS[m - 1]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="trackingCategoryId">Class</Label>
        <NativeSelect id="trackingCategoryId" name="trackingCategoryId" className="w-40" defaultValue="">
          <option value="">None</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount</Label>
        <Input id="amount" name="amount" required className="w-40" placeholder="0.00" />
      </div>
      <Button type="submit" disabled={pending}>
        Save line
      </Button>
    </form>
  )
}

export function RemoveLineButton({ lineId, canEdit }: { lineId: string; canEdit: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (!canEdit) return null
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deleteBudgetLine({ lineId })
          router.refresh()
        })
      }
    >
      Remove
    </Button>
  )
}

export function CopyBudgetForm({ sourceId }: { sourceId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <form
      className="mb-6 grid max-w-xl gap-3 rounded-md border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        setError(null)
        start(async () => {
          const result = await copyBudget({
            sourceId,
            name: String(fd.get('name') ?? ''),
            startDate: String(fd.get('startDate') ?? ''),
            endDate: String(fd.get('endDate') ?? ''),
            percent: Number(fd.get('percent') || 0),
          })
          if (result && 'ok' in result && !result.ok) setError(result.error.message)
        })
      }}
    >
      <p className="text-sm font-medium">Copy to new year</p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="copy-name">Name</Label>
        <Input id="copy-name" name="name" required placeholder="FY 2027 operating" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="copy-start">Start</Label>
          <Input id="copy-start" name="startDate" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="copy-end">End</Label>
          <Input id="copy-end" name="endDate" type="date" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="percent">Inflate %</Label>
        <Input id="percent" name="percent" type="number" step="0.1" defaultValue="0" />
      </div>
      <Button type="submit" variant="outline" className="w-fit" disabled={pending}>
        {pending ? 'Copying…' : 'Copy budget'}
      </Button>
    </form>
  )
}

export function ImportBudgetCsvForm({ budgetId, canEdit }: { budgetId: string; canEdit: boolean }) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (!canEdit) return null

  return (
    <form
      className="mb-6 grid max-w-xl gap-3 rounded-md border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const file = fd.get('file')
        if (!(file instanceof File)) return
        setError(null)
        setMessage(null)
        start(async () => {
          const csv = await file.text()
          const preview = await importBudgetCsv({ budgetId, csv, commit: false })
          if (!preview.ok) {
            setError(preview.error.message)
            return
          }
          if (preview.data.issues.length > 0) {
            setError(preview.data.issues.map((i) => `Line ${i.line}: ${i.message}`).join('; '))
            return
          }
          const commit = await importBudgetCsv({ budgetId, csv, commit: true })
          if (!commit.ok) {
            setError(commit.error.message)
            return
          }
          setMessage(`Imported ${commit.data.readyCount} rows.`)
          router.refresh()
        })
      }}
    >
      <p className="text-sm font-medium">Import CSV</p>
      <p className="text-xs text-muted-foreground">
        Columns: accountCode, month (1–12 or YYYY-MM), amount, optional className
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Input name="file" type="file" accept=".csv,text/csv" required />
      <Button type="submit" variant="outline" className="w-fit" disabled={pending}>
        {pending ? 'Importing…' : 'Import'}
      </Button>
    </form>
  )
}

export function MoneyCell({ amount, currency }: { amount: string; currency: string }) {
  return <>{formatMoney(amount, currency)}</>
}

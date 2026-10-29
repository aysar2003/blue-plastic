'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createHrBudget, deleteHrBudget } from './actions'

type Row = {
  id: string
  year: number
  name: string
  totalWage: string
  maxHeadcount: number
}

export function BudgetList({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [name, setName] = useState('Wage plan')

  function create() {
    startBusy(async () => {
      const result = await createHrBudget({
        year: Number(year),
        name: name.trim() || `Budget ${year}`,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not create')
        return
      }
      toast.success('Budget created')
      router.push(`/employees/budget/${result.data?.id}`)
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!window.confirm('Delete this year budget?')) return
    startBusy(async () => {
      const result = await deleteHrBudget({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Delete failed')
        return
      }
      toast.success('Deleted')
      router.refresh()
    })
  }

  return (
    <div className="grid max-w-3xl gap-6">
      {canManage ? (
        <section className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Year</Label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="button" disabled={busy} onClick={create}>
              Create year budget
            </Button>
          </div>
        </section>
      ) : null}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {rows.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No HR budgets yet. Create a calendar year plan for wage totals and headcount.
          </li>
        ) : (
          rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
              <div>
                <Link href={`/employees/budget/${row.id}`} className="font-medium text-primary hover:underline">
                  {row.year} — {row.name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  Planned wage {Number(row.totalWage).toFixed(2)} · peak headcount {row.maxHeadcount}
                </div>
              </div>
              {canManage ? (
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => remove(row.id)}>
                  Delete
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateHrBudgetMonth } from '../actions'

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

type Month = { id: string; month: number; plannedWage: string; plannedHeadcount: number }

export function BudgetDetail({
  budgetId,
  months,
  canManage,
}: {
  budgetId: string
  months: Month[]
  canManage: boolean
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [draft, setDraft] = useState(
    Object.fromEntries(
      months.map((m) => [
        m.month,
        { wage: strip(m.plannedWage), headcount: String(m.plannedHeadcount) },
      ]),
    ) as Record<number, { wage: string; headcount: string }>,
  )

  function save(month: number) {
    const row = draft[month]
    if (!row) return
    startBusy(async () => {
      const result = await updateHrBudgetMonth({
        budgetId,
        month,
        plannedWage: row.wage || '0',
        plannedHeadcount: Number(row.headcount) || 0,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Save failed')
        return
      }
      toast.success(`${MONTHS[month - 1]} saved`)
      router.refresh()
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Month</th>
            <th className="px-3 py-2 font-medium">Planned wage</th>
            <th className="px-3 py-2 font-medium">Headcount</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-medium">{MONTHS[m.month - 1]}</td>
              <td className="px-3 py-2">
                <Input
                  className="h-8 max-w-[10rem]"
                  value={draft[m.month]?.wage ?? ''}
                  disabled={!canManage || busy}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [m.month]: { ...prev[m.month]!, wage: e.target.value },
                    }))
                  }
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  className="h-8 max-w-[6rem]"
                  type="number"
                  value={draft[m.month]?.headcount ?? ''}
                  disabled={!canManage || busy}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [m.month]: { ...prev[m.month]!, headcount: e.target.value },
                    }))
                  }
                />
              </td>
              <td className="px-3 py-2 text-right">
                {canManage ? (
                  <Button type="button" size="sm" disabled={busy} onClick={() => save(m.month)}>
                    Save
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function strip(value: string) {
  return value.replace(/\.?0+$/, '') || '0'
}

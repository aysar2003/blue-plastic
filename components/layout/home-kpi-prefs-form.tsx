'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { saveDashboardKpiPins } from '@/app/(app)/dashboard/actions'
import type { HomeKpiKey } from '@/lib/dashboard-prefs'

const OPTIONS: { key: HomeKpiKey; label: string }[] = [
  { key: 'profitMtd', label: 'P&L this month' },
  { key: 'openAr', label: 'What customers owe' },
  { key: 'reorder', label: 'To reorder' },
  { key: 'pipeline', label: 'Open pipeline' },
  { key: 'unpaidAp', label: 'Unpaid bills' },
  { key: 'followUps', label: 'Follow-ups' },
]

export function HomeKpiPrefsForm({ pinned }: { pinned: readonly HomeKpiKey[] }) {
  const router = useRouter()
  const set = new Set(pinned)
  const [open, setOpen] = useState(false)

  return (
    <div className="text-xs text-muted-foreground">
      <button
        type="button"
        className="font-medium text-foreground underline-offset-4 hover:underline"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Hide home numbers' : 'Choose home numbers'}
      </button>
      {open ? (
        <form
          className="mt-2 flex flex-wrap items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const form = event.currentTarget
            const keys = OPTIONS.filter((opt) => {
              const input = form.elements.namedItem(`kpi-${opt.key}`) as HTMLInputElement | null
              return input?.checked
            }).map((opt) => opt.key)
            void saveDashboardKpiPins({ kpiPins: keys }).then(() => router.refresh())
          }}
        >
          {OPTIONS.map((opt) => (
            <label key={opt.key} className="inline-flex items-center gap-1">
              <input type="checkbox" name={`kpi-${opt.key}`} defaultChecked={set.has(opt.key)} />
              {opt.label}
            </label>
          ))}
          <button type="submit" className="text-primary hover:underline">
            Save
          </button>
        </form>
      ) : null}
    </div>
  )
}

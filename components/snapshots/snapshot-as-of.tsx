'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { DateField } from '@/components/ui/date-field'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { PERIOD_LABELS, type PeriodKey } from '@/lib/report-periods'
import type { CalendarDate } from '@/lib/date'

/**
 * Period + as-of date for Company Snapshot.
 * Writes to the URL so the server reloads ledger figures for that date.
 */
export function SnapshotAsOf({
  period,
  asOf,
  orgToday,
}: {
  period: PeriodKey
  asOf: CalendarDate
  orgToday: CalendarDate
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState({ period, asOf })

  const settled = `${period}|${asOf}`
  const [lastSettled, setLastSettled] = useState(settled)
  if (settled !== lastSettled) {
    setLastSettled(settled)
    setDraft({ period, asOf })
  }

  const apply = (next: Partial<typeof draft>) => {
    const merged = { ...draft, ...next }
    setDraft(merged)

    const params = new URLSearchParams(searchParams.toString())
    params.delete('from')
    params.delete('to')
    params.set('period', merged.period)
    if (merged.period === 'custom') {
      params.set('asOf', merged.asOf)
    } else {
      params.delete('asOf')
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/70 bg-card/80 px-3 py-2.5 shadow-sm snapshot-fade-in">
      <div className="space-y-1">
        <Label htmlFor="snapshot-period" className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          Period
        </Label>
        <NativeSelect
          id="snapshot-period"
          className="w-48"
          value={draft.period}
          disabled={pending}
          onChange={(event) => apply({ period: event.target.value as PeriodKey })}
        >
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((key) => (
            <option key={key} value={key}>
              {PERIOD_LABELS[key]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1">
        <Label htmlFor="snapshot-asOf" className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          As of
        </Label>
        <DateField
          id="snapshot-asOf"
          className="w-44"
          value={draft.asOf}
          today={orgToday}
          onChange={(next) => {
            setDraft({ period: 'custom', asOf: next })
            if (next !== asOf) apply({ period: 'custom', asOf: next })
          }}
        />
      </div>
      {pending ? (
        <span className="pb-1.5 text-xs text-muted-foreground">Updating…</span>
      ) : null}
    </div>
  )
}

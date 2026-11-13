'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import {
  ANALYTICS_PERIOD_OPTIONS,
} from '@/lib/analytics-period'
import { PERIOD_LABELS, type PeriodKey } from '@/lib/report-periods'

export function AnalyticsPeriod({
  periodKey,
  from,
  to,
}: {
  periodKey: PeriodKey
  from: string
  to: string
}) {
  const router = useRouter()
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)

  function go(next: { period: PeriodKey; from?: string; to?: string }) {
    const params = new URLSearchParams()
    params.set('period', next.period)
    if (next.period === 'custom') {
      params.set('from', next.from ?? customFrom)
      params.set('to', next.to ?? customTo)
    }
    router.push(`/analytics?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-2 text-sm">
      <div className="flex flex-col gap-1">
        <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="analytics-period">
          Date range
        </label>
        <select
          id="analytics-period"
          className="min-w-[11rem] rounded-md border border-border bg-card px-2 py-1.5"
          value={periodKey}
          onChange={(event) => {
            const value = event.target.value as PeriodKey
            if (value === 'custom') {
              go({ period: 'custom', from: customFrom, to: customTo })
              return
            }
            go({ period: value })
          }}
        >
          {ANALYTICS_PERIOD_OPTIONS.map((key) => (
            <option key={key} value={key}>
              {PERIOD_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {periodKey === 'custom' ? (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="analytics-from">
              From
            </label>
            <input
              id="analytics-from"
              type="date"
              className="rounded-md border border-border bg-card px-2 py-1.5"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="analytics-to">
              To
            </label>
            <input
              id="analytics-to"
              type="date"
              className="rounded-md border border-border bg-card px-2 py-1.5"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            onClick={() => go({ period: 'custom', from: customFrom, to: customTo })}
          >
            Apply
          </button>
        </>
      ) : (
        <p className="pb-1.5 text-xs text-muted-foreground">
          {from} → {to}
        </p>
      )}
    </div>
  )
}

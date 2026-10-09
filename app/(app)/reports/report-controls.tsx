'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DownloadIcon, FileDownIcon, Loader2Icon, PrinterIcon } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import { NativeSelect } from '@/components/ui/native-select'
import { Label } from '@/components/ui/label'
import { PERIOD_LABELS, type PeriodKey } from '@/lib/report-periods'
import { COMPARISON_LABELS, type ComparisonKey } from './params'

export type ControlSet = {
  /** A balance sheet is stated at a date; everything else covers a range. */
  mode: 'range' | 'asOf'
  basis?: boolean
  comparison?: boolean
  /** Report key for the CSV endpoint. Omitted where export makes no sense. */
  exportAs?: string
}

/**
 * One control bar for every report.
 *
 * It writes to the URL rather than holding state, so the server component
 * re-renders with real data and the back button works. The transition keeps the
 * previous figures on screen while the next set is fetched, which reads as fast
 * even when the query is not.
 */
export function ReportControls({
  period,
  from,
  to,
  asOf,
  basis,
  comparison,
  controls,
}: {
  period: PeriodKey
  from: string
  to: string
  asOf: string
  basis: 'accrual' | 'cash'
  comparison: ComparisonKey
  controls: ControlSet
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const [draft, setDraft] = useState({ period, from, to, asOf, basis, comparison })

  // The URL is the source of truth; the draft only holds an edit in flight. When
  // the server comes back with different dates — which it does whenever a preset
  // is chosen — the inputs have to show them rather than what was typed before.
  const settled = `${period}|${from}|${to}|${asOf}|${basis}|${comparison}`
  const [lastSettled, setLastSettled] = useState(settled)
  if (settled !== lastSettled) {
    setLastSettled(settled)
    setDraft({ period, from, to, asOf, basis, comparison })
  }

  const apply = (next: Partial<typeof draft>) => {
    const merged = { ...draft, ...next }
    setDraft(merged)

    // Keep the rest of the address — a statement's customer, a filter — and
    // only replace the dates this bar owns.
    const params = new URLSearchParams(searchParams.toString())
    for (const key of ['period', 'from', 'to', 'asOf', 'basis', 'compare']) params.delete(key)
    params.set('period', merged.period)
    // A preset resolves its own dates on the server. Sending the old ones would
    // only survive to confuse a later switch to a custom range.
    if (merged.period === 'custom') {
      params.set('from', merged.from)
      params.set('to', merged.to)
      params.set('asOf', merged.asOf)
    }
    if (controls.basis) params.set('basis', merged.basis)
    if (controls.comparison) params.set('compare', merged.comparison)

    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  const exportHref = controls.exportAs
    ? `/api/reports/${controls.exportAs}?${new URLSearchParams(searchParams).toString()}`
    : null

  const savePdf = () => {
    // Same path as statements and invoices: browser print → Save as PDF.
    window.print()
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
      <div className="space-y-1.5">
        <Label htmlFor="period">Period</Label>
        <NativeSelect
          id="period"
          className="w-44"
          value={draft.period}
          onChange={(event) => apply({ period: event.target.value as PeriodKey })}
        >
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((key) => (
            <option key={key} value={key}>
              {PERIOD_LABELS[key]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {controls.mode === 'range' ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <DateField
              id="from"
              className="w-44"
              value={draft.from}
              onChange={(next) => {
                setDraft({ ...draft, period: 'custom', from: next })
                if (next !== from) apply({ period: 'custom', from: next })
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <DateField
              id="to"
              className="w-44"
              value={draft.to}
              onChange={(next) => {
                setDraft({ ...draft, period: 'custom', to: next })
                if (next !== to) apply({ period: 'custom', to: next })
              }}
            />
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="asOf">As of</Label>
          <DateField
            id="asOf"
            className="w-44"
            value={draft.asOf}
            onChange={(next) => {
              setDraft({ ...draft, period: 'custom', asOf: next })
              if (next !== asOf) apply({ period: 'custom', asOf: next })
            }}
          />
        </div>
      )}

      {controls.basis ? (
        <div className="space-y-1.5">
          <Label htmlFor="basis">Basis</Label>
          <NativeSelect
            id="basis"
            className="w-36"
            value={draft.basis}
            onChange={(event) => apply({ basis: event.target.value as 'accrual' | 'cash' })}
          >
            <option value="accrual">Accrual</option>
            <option value="cash">Cash</option>
          </NativeSelect>
        </div>
      ) : null}

      {controls.comparison ? (
        <div className="space-y-1.5">
          <Label htmlFor="compare">Compare</Label>
          <NativeSelect
            id="compare"
            className="w-44"
            value={draft.comparison}
            onChange={(event) => apply({ comparison: event.target.value as ComparisonKey })}
          >
            {(Object.keys(COMPARISON_LABELS) as ComparisonKey[]).map((key) => (
              <option key={key} value={key}>
                {COMPARISON_LABELS[key]}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      <Button type="button" variant="outline" onClick={() => apply({})} disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Apply
      </Button>

      {exportHref ? (
        <a href={exportHref} className={buttonVariants({ variant: 'ghost' })} download>
          <DownloadIcon /> CSV
        </a>
      ) : null}

      <Button type="button" variant="ghost" onClick={savePdf} title="Print or Save as PDF">
        <PrinterIcon /> Print
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={savePdf}
        title="Opens print — choose Save as PDF"
      >
        <FileDownIcon /> PDF
      </Button>
    </div>
  )
}

'use client'

import { useEffect, useState, type KeyboardEvent } from 'react'

import {
  PERFORMANCE_ALL_DAYS,
  PERFORMANCE_PERIOD_DAYS,
  type PerformancePeriodDays,
  isAllPerformanceDays,
} from '@/lib/user-performance'
import { cn } from '@/lib/utils'

type Props = {
  days: PerformancePeriodDays
  onChange: (days: PerformancePeriodDays) => void
  className?: string
  /** Active chip style — matches surrounding surfaces. */
  tone?: 'default' | 'indigo'
}

export function PerformancePeriodPicker({
  days,
  onChange,
  className,
  tone = 'default',
}: Props) {
  const isPreset =
    isAllPerformanceDays(days) ||
    (PERFORMANCE_PERIOD_DAYS as readonly number[]).includes(days)
  const [customDraft, setCustomDraft] = useState(isPreset ? '' : String(days))

  useEffect(() => {
    const preset =
      isAllPerformanceDays(days) ||
      (PERFORMANCE_PERIOD_DAYS as readonly number[]).includes(days)
    setCustomDraft(preset ? '' : String(days))
  }, [days])

  function commitCustom(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return
    const n = Number(trimmed)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return
    onChange(n)
  }

  function onCustomKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitCustom(customDraft)
    }
  }

  const activeChip =
    tone === 'indigo'
      ? 'bg-primary text-primary-foreground shadow-sm'
      : 'bg-background/80 text-foreground shadow-sm'
  const idleChip =
    tone === 'indigo'
      ? 'text-muted-foreground hover:text-foreground'
      : 'text-muted-foreground hover:text-foreground'
  const shell =
    tone === 'indigo'
      ? 'border-border/80 bg-card/90'
      : 'border-border/60 bg-background/30'
  const inputShell =
    tone === 'indigo'
      ? 'border-border/80 bg-card/90 text-foreground'
      : 'border-border/60 bg-background/40 text-foreground'

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <div className={cn('inline-flex rounded-xl border p-1', shell)}>
        {PERFORMANCE_PERIOD_DAYS.map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => onChange(period)}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all',
              days === period ? activeChip : idleChip,
            )}
          >
            {period}d
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(PERFORMANCE_ALL_DAYS)}
          className={cn(
            'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all',
            isAllPerformanceDays(days) ? activeChip : idleChip,
          )}
        >
          All
        </button>
      </div>
      <label
        className={cn(
          'inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs',
          inputShell,
        )}
      >
        <input
          type="number"
          min={1}
          max={3650}
          inputMode="numeric"
          placeholder="Days"
          value={customDraft}
          onChange={(e) => setCustomDraft(e.target.value)}
          onBlur={() => commitCustom(customDraft)}
          onKeyDown={onCustomKeyDown}
          className="w-12 bg-transparent text-center text-xs font-semibold tabular-nums outline-none placeholder:font-medium placeholder:text-muted-foreground"
          aria-label="Custom days"
        />
        <span className="text-muted-foreground">d</span>
      </label>
    </div>
  )
}

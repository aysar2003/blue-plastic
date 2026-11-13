import { endOfMonth, isCalendarDate, startOfMonth, today, type CalendarDate } from '@/lib/date'
import {
  EARLIEST_DATE,
  PERIOD_LABELS,
  isPeriodKey,
  priorPeriod,
  resolvePeriod,
  type Period,
  type PeriodKey,
} from '@/lib/report-periods'

/** Periods shown on the Analytics date control (includes All dates). */
export const ANALYTICS_PERIOD_OPTIONS: PeriodKey[] = [
  'today',
  'this-week',
  'last-week',
  'this-month',
  'last-month',
  'this-quarter',
  'last-quarter',
  'year-to-date',
  'this-fiscal-year',
  'last-fiscal-year',
  'all-dates',
  'custom',
]

export type AnalyticsPeriodSelection = {
  key: PeriodKey
  range: Period
  label: string
  prior: Period
}

export function analyticsPeriodLabel(key: PeriodKey, range: Period): string {
  if (key === 'custom' || key === 'all-dates') {
    if (key === 'all-dates') return PERIOD_LABELS['all-dates']
    return `${range.from} → ${range.to}`
  }
  return PERIOD_LABELS[key]
}

/**
 * Resolve Analytics period from URL params.
 * Supports `period` (+ optional custom `from`/`to`) and legacy `month=YYYY-MM`.
 */
export function resolveAnalyticsPeriod(input: {
  period?: string | null
  from?: string | null
  to?: string | null
  month?: string | null
  timeZone: string
  fiscalYearStartMonth: number
}): AnalyticsPeriodSelection {
  const now = today(input.timeZone)

  // Legacy month deep-link.
  if ((!input.period || input.period === 'month') && input.month && /^\d{4}-\d{2}$/.test(input.month)) {
    const from = `${input.month}-01`
    if (isCalendarDate(from)) {
      const range = { from, to: endOfMonth(from) }
      return {
        key: 'custom',
        range,
        label: from.slice(0, 7),
        prior: priorPeriod(range),
      }
    }
  }

  const key: PeriodKey = isPeriodKey(input.period) ? input.period : 'last-month'
  const customFrom =
    input.from && isCalendarDate(input.from) ? (input.from as CalendarDate) : undefined
  const customTo = input.to && isCalendarDate(input.to) ? (input.to as CalendarDate) : undefined
  const range = resolvePeriod(key, now, input.fiscalYearStartMonth, {
    from: customFrom,
    to: customTo,
  })

  // Clamp future "to" to today for open-ended keys.
  const clamped =
    range.to > now
      ? { from: range.from < EARLIEST_DATE ? EARLIEST_DATE : range.from, to: now }
      : range

  return {
    key,
    range: clamped,
    label: analyticsPeriodLabel(key, clamped),
    prior: priorPeriod(clamped),
  }
}

export function analyticsPeriodQuery(selection: AnalyticsPeriodSelection): string {
  const params = new URLSearchParams()
  params.set('period', selection.key)
  if (selection.key === 'custom') {
    params.set('from', selection.range.from)
    params.set('to', selection.range.to)
  }
  return params.toString()
}

export function isSingleCalendarMonth(range: Period): boolean {
  return range.from === startOfMonth(range.from) && range.to === endOfMonth(range.from)
}

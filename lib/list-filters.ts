import { addMonths, endOfMonth, startOfMonth, type CalendarDate } from '@/lib/date'

/** The date choices QuickBooks puts above a transaction list. */
export const DATE_PRESETS = [
  { value: '', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This month' },
  { value: 'last', label: 'Last month' },
  { value: 'last3', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
  { value: 'last12', label: 'Last 12 months' },
] as const

export type DatePreset = (typeof DATE_PRESETS)[number]['value']

export function isDatePreset(value: string | undefined): value is DatePreset {
  return DATE_PRESETS.some((preset) => preset.value === value)
}

export function readDatePreset(value: string | string[] | undefined): DatePreset {
  const raw = typeof value === 'string' ? value : undefined
  return isDatePreset(raw) ? raw : ''
}

/** Inclusive calendar range for a preset. Empty means every date. */
export function presetRange(
  preset: string | undefined,
  asOf: CalendarDate,
): { from: CalendarDate; to: CalendarDate } | undefined {
  if (!preset) return undefined
  if (preset === 'today') return { from: asOf, to: asOf }
  if (preset === 'month') return { from: startOfMonth(asOf), to: endOfMonth(asOf) }
  if (preset === 'last') {
    const previous = addMonths(startOfMonth(asOf), -1)
    return { from: startOfMonth(previous), to: endOfMonth(previous) }
  }
  if (preset === 'last3') return { from: addMonths(asOf, -3), to: asOf }
  if (preset === 'year') {
    const year = asOf.slice(0, 4)
    return { from: `${year}-01-01`, to: `${year}-12-31` }
  }
  if (preset === 'last12') return { from: addMonths(asOf, -12), to: asOf }
  return undefined
}

export function listHref(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

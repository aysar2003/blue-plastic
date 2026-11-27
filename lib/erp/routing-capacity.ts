/** Weekly capacity from explicit total or weekday minutes (Mon–Sun). */
export function effectiveWeeklyCapacity(
  capacityMinutesPerWeek: string | number,
  capacityByWeekday: number[] | null | undefined,
): number {
  if (capacityByWeekday && capacityByWeekday.length === 7) {
    return capacityByWeekday.reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0)
  }
  const n = Number(capacityMinutesPerWeek)
  return Number.isFinite(n) ? n : 0
}

export function isWorkCenterOverloaded(demandMinutes: number, weeklyCapacity: number): boolean {
  if (weeklyCapacity <= 0) return demandMinutes > 0.0001
  return demandMinutes > weeklyCapacity + 0.0001
}

export function loadPercent(demandMinutes: number, weeklyCapacity: number): number {
  if (weeklyCapacity <= 0) return demandMinutes > 0 ? 999 : 0
  return Math.round((demandMinutes / weeklyCapacity) * 1000) / 10
}

export function sumWeekdayCapacity(values: readonly (string | number)[]): number {
  return values.reduce<number>((sum, value) => {
    const n = Number(value)
    return sum + (Number.isFinite(n) && n > 0 ? n : 0)
  }, 0)
}

/** Monday = 0 … Sunday = 6 for a calendar date (YYYY-MM-DD or Date). */
export function weekdayIndexMon0(date: string | Date): number {
  const iso = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10)
  const utc = new Date(`${iso}T00:00:00.000Z`)
  const js = utc.getUTCDay()
  return js === 0 ? 6 : js - 1
}

/**
 * Subtract holiday/exception days from weekly capacity.
 * Each exception zeros that weekday's minutes (or weekly/7 when no weekday split).
 */
export function capacityAfterExceptions(
  weeklyCapacity: number,
  capacityByWeekday: number[] | null | undefined,
  exceptionDates: readonly (string | Date)[],
): number {
  if (exceptionDates.length === 0) return weeklyCapacity
  const byDay =
    capacityByWeekday && capacityByWeekday.length === 7
      ? capacityByWeekday.map((n) => (Number.isFinite(n) && n > 0 ? n : 0))
      : null
  const perDayFallback = weeklyCapacity > 0 ? weeklyCapacity / 7 : 0
  const seen = new Set<number>()
  let subtract = 0
  for (const date of exceptionDates) {
    const idx = weekdayIndexMon0(date)
    if (seen.has(idx)) continue
    seen.add(idx)
    subtract += byDay ? byDay[idx] ?? 0 : perDayFallback
  }
  const next = weeklyCapacity - subtract
  return next > 0 ? next : 0
}

export type CapacityCsvRow = {
  centerName: string
  storeName: string | null
  capacityMinutes: string
  demandMinutes: string
  loadPercent: number
  workOrderNumbers: string[]
}

export function capacityReportCsvRows(rows: CapacityCsvRow[]) {
  return rows.map((row) => [
    row.centerName,
    row.storeName ?? '',
    row.capacityMinutes,
    row.demandMinutes,
    row.loadPercent,
    row.workOrderNumbers.join('; '),
  ])
}
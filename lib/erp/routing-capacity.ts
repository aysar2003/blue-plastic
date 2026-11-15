import { Decimal } from '@/lib/money'

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
import { Decimal, ZERO } from '@/lib/money'

export type HoursCsvRow = {
  date: string
  employee: string
  kind: 'leave' | 'attendance'
  hours: string
  note?: string | null
}

/** Convert approved leave days to hours at the org hours/day (default 8). */
export function leaveDaysToHours(days: Decimal.Value, hoursPerDay: Decimal.Value = 8): string {
  const hours = new Decimal(days).times(hoursPerDay)
  if (hours.lessThanOrEqualTo(ZERO)) return '0.0000'
  return hours.toFixed(4)
}

export function hoursFileCsv(rows: HoursCsvRow[]): string {
  const header = ['date', 'employee', 'kind', 'hours', 'note']
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.date,
        csvEscape(row.employee),
        row.kind,
        row.hours,
        csvEscape(row.note ?? ''),
      ].join(','),
    )
  }
  return `${lines.join('\r\n')}\r\n`
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

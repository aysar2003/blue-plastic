import { HOURS_HEADERS } from '@/lib/erp/export-headers'
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

export function hoursFileTableRows(rows: HoursCsvRow[]): string[][] {
  return rows.map((row) => [row.date, row.employee, row.kind, row.hours, row.note ?? ''])
}

export function hoursFileCsv(rows: HoursCsvRow[]): string {
  const lines = [[...HOURS_HEADERS].join(',')]
  for (const cells of hoursFileTableRows(rows)) {
    lines.push(
      [
        cells[0]!,
        csvEscape(cells[1]!),
        cells[2]!,
        cells[3]!,
        csvEscape(cells[4] ?? ''),
      ].join(','),
    )
  }
  return `${lines.join('\r\n')}\r\n`
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

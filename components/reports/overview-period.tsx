'use client'

import { useRouter } from 'next/navigation'

const MONTHS = [
  ['01', 'January'],
  ['02', 'February'],
  ['03', 'March'],
  ['04', 'April'],
  ['05', 'May'],
  ['06', 'June'],
  ['07', 'July'],
  ['08', 'August'],
  ['09', 'September'],
  ['10', 'October'],
  ['11', 'November'],
  ['12', 'December'],
] as const

/** Month and year for the business overview. Changing either reloads the figures. */
export function OverviewPeriod({ month, years }: { month: string; years: number[] }) {
  const router = useRouter()
  const [year, monthNumber] = month.split('-')

  function go(nextYear: string, nextMonth: string) {
    router.push(`/reports/business-overview?month=${nextYear}-${nextMonth}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="text-muted-foreground" htmlFor="overview-month">
        Month
      </label>
      <select
        id="overview-month"
        className="rounded-md border border-border bg-card px-2 py-1"
        value={monthNumber}
        onChange={(event) => go(year ?? '', event.target.value)}
      >
        {MONTHS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label className="text-muted-foreground" htmlFor="overview-year">
        Year
      </label>
      <select
        id="overview-year"
        className="rounded-md border border-border bg-card px-2 py-1"
        value={year}
        onChange={(event) => go(event.target.value, monthNumber ?? '01')}
      >
        {years.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  )
}

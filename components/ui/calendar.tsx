'use client'

import * as React from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { addMonths, startOfMonth, toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { cn } from '@/lib/utils'

/**
 * A month grid with month and year pickers.
 *
 * Written here rather than pulled from a date library for the same reason the
 * combobox is: what it has to be right about is the *calendar date*, not an
 * instant. Every date in this system is a `YYYY-MM-DD` string — an invoice dated
 * the 1st is dated the 1st in every timezone — and a picker built on `Date`
 * objects is one daylight-saving boundary away from posting an entry into the
 * wrong month. So the arithmetic goes through `lib/date`, which is the same code
 * the ledger uses.
 *
 * Click the month/year title to jump by month or year without paging one step
 * at a time — same pattern people expect from a modern calendar table.
 */
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

type View = 'days' | 'months' | 'years'

/** Days of the grid, Monday-first, padded with the neighbouring months. */
function gridFor(month: CalendarDate): { date: CalendarDate; outside: boolean }[] {
  const first = toDate(startOfMonth(month))
  // getUTCDay is 0 for Sunday; the grid starts on Monday.
  const lead = (first.getUTCDay() + 6) % 7

  const days: { date: CalendarDate; outside: boolean }[] = []
  const cursor = new Date(first)
  cursor.setUTCDate(cursor.getUTCDate() - lead)

  for (let index = 0; index < 42; index++) {
    const date = toCalendarDate(cursor)
    days.push({ date, outside: date.slice(0, 7) !== month.slice(0, 7) })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return days
}

function decadeStart(year: number): number {
  return Math.floor(year / 10) * 10
}

function monthFromParts(year: number, monthIndex: number): CalendarDate {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
}

export function Calendar({
  value,
  onSelect,
  today,
  className,
}: {
  value: CalendarDate | null
  onSelect: (date: CalendarDate) => void
  /** Marked with a ring. The organisation's today, not the browser's. */
  today?: CalendarDate
  className?: string
}) {
  const [month, setMonth] = React.useState<CalendarDate>(startOfMonth(value ?? today ?? '2026-01-01'))
  const [view, setView] = React.useState<View>('days')

  // Following the value lets a typed date move the grid without an effect.
  const [lastValue, setLastValue] = React.useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    if (value) setMonth(startOfMonth(value))
  }

  const days = gridFor(month)
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7)) - 1
  const decade = decadeStart(year)
  const selectedYear = value ? Number(value.slice(0, 4)) : null
  const selectedMonthKey = value ? value.slice(0, 7) : null

  const title =
    view === 'days'
      ? `${MONTH_NAMES[monthIndex]} ${year}`
      : view === 'months'
        ? String(year)
        : `${decade} – ${decade + 9}`

  const stepBack = () => {
    if (view === 'days') setMonth(addMonths(month, -1))
    else if (view === 'months') setMonth(monthFromParts(year - 1, monthIndex))
    else setMonth(monthFromParts(decade - 10, monthIndex))
  }

  const stepForward = () => {
    if (view === 'days') setMonth(addMonths(month, 1))
    else if (view === 'months') setMonth(monthFromParts(year + 1, monthIndex))
    else setMonth(monthFromParts(decade + 10, monthIndex))
  }

  const openPicker = () => {
    if (view === 'days') setView('months')
    else if (view === 'months') setView('years')
  }

  return (
    <div className={cn('w-[17.5rem] select-none bg-card p-3', className)}>
      <div className="mb-3 flex items-center justify-between gap-1">
        <button
          type="button"
          aria-label={
            view === 'years' ? 'Previous decade' : view === 'months' ? 'Previous year' : 'Previous month'
          }
          onClick={stepBack}
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronLeftIcon className="size-4" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={openPicker}
          disabled={view === 'years'}
          aria-label={
            view === 'days'
              ? 'Choose month'
              : view === 'months'
                ? 'Choose year'
                : undefined
          }
          className={cn(
            'rounded-md px-2 py-1 text-[0.9375rem] font-semibold tracking-tight text-foreground',
            view !== 'years' && 'hover:bg-accent',
            view === 'years' && 'cursor-default',
          )}
          aria-live="polite"
        >
          {title}
        </button>

        <button
          type="button"
          aria-label={view === 'years' ? 'Next decade' : view === 'months' ? 'Next year' : 'Next month'}
          onClick={stepForward}
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronRightIcon className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      {view === 'days' ? (
        <div className="grid grid-cols-7 gap-y-1">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="grid h-8 place-items-center text-[0.75rem] font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}

          {days.map(({ date, outside }) => {
            const selected = date === value
            const isToday = date === today

            return (
              <button
                key={date}
                type="button"
                aria-label={date}
                aria-current={selected ? 'date' : undefined}
                onClick={() => onSelect(date)}
                className={cn(
                  'grid h-9 place-items-center rounded-md text-[0.875rem] tabular transition-colors',
                  outside && 'text-muted-foreground/35',
                  !outside && !selected && 'text-foreground',
                  !selected && 'hover:bg-accent hover:text-accent-foreground',
                  selected && 'bg-primary font-semibold text-primary-foreground',
                  isToday && !selected && 'font-semibold text-primary ring-1 ring-inset ring-primary/45',
                )}
              >
                {Number(date.slice(8, 10))}
              </button>
            )
          })}
        </div>
      ) : null}

      {view === 'months' ? (
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_SHORT.map((label, index) => {
            const key = `${year}-${String(index + 1).padStart(2, '0')}`
            const selected = selectedMonthKey === key
            const current = today?.slice(0, 7) === key
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setMonth(monthFromParts(year, index))
                  setView('days')
                }}
                className={cn(
                  'h-11 rounded-md text-sm font-medium transition-colors',
                  !selected && 'text-foreground hover:bg-accent',
                  selected && 'bg-primary font-semibold text-primary-foreground',
                  current && !selected && 'ring-1 ring-inset ring-primary/45',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      ) : null}

      {view === 'years' ? (
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 12 }, (_, index) => decade - 1 + index).map((itemYear) => {
            const outside = itemYear < decade || itemYear > decade + 9
            const selected = selectedYear === itemYear
            const current = today ? Number(today.slice(0, 4)) === itemYear : false
            return (
              <button
                key={itemYear}
                type="button"
                onClick={() => {
                  setMonth(monthFromParts(itemYear, monthIndex))
                  setView('months')
                }}
                className={cn(
                  'h-11 rounded-md text-sm font-medium tabular transition-colors',
                  outside && 'text-muted-foreground/35',
                  !outside && !selected && 'text-foreground hover:bg-accent',
                  selected && 'bg-primary font-semibold text-primary-foreground',
                  current && !selected && 'ring-1 ring-inset ring-primary/45',
                )}
              >
                {itemYear}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

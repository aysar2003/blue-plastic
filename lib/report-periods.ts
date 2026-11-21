import {
  addDays,
  addMonths,
  dayBefore,
  endOfMonth,
  fiscalYearOf,
  fiscalYearRange,
  normalizeFiscalYearStart,
  startOfMonth,
  type CalendarDate,
  type FiscalYearStart,
} from '@/lib/date'

/**
 * The date ranges people actually ask for.
 *
 * Kept out of the report engines because a period is a question about the
 * calendar, not about the ledger, and both the server pages and the client
 * controls need to agree on what "last quarter" means.
 */
export type PeriodKey =
  | 'today'
  | 'this-week'
  | 'last-week'
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'last-quarter'
  | 'fy-q1'
  | 'fy-q2'
  | 'fy-q3'
  | 'fy-q4'
  | 'last-fy-q1'
  | 'last-fy-q2'
  | 'last-fy-q3'
  | 'last-fy-q4'
  | 'this-fiscal-year'
  | 'last-fiscal-year'
  | 'year-to-date'
  | 'all-dates'
  | 'custom'

/**
 * Listed in the order somebody looks for them: the short periods first, then
 * the long ones, then everything, then a date range of their own.
 *
 * "This year" means the *fiscal* year, because that is the year the business's
 * accounts are drawn up for. Saying so in the label rather than in a footnote
 * avoids the January surprise for a business whose year starts in April.
 */
export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: 'Today',
  'this-week': 'This week',
  'last-week': 'Last week',
  'this-month': 'This month',
  'last-month': 'Last month',
  'this-quarter': 'This quarter',
  'last-quarter': 'Last quarter',
  'fy-q1': 'This year — Q1',
  'fy-q2': 'This year — Q2',
  'fy-q3': 'This year — Q3',
  'fy-q4': 'This year — Q4',
  'last-fy-q1': 'Last year — Q1',
  'last-fy-q2': 'Last year — Q2',
  'last-fy-q3': 'Last year — Q3',
  'last-fy-q4': 'Last year — Q4',
  'this-fiscal-year': 'This year (fiscal)',
  'last-fiscal-year': 'Last year (fiscal)',
  'year-to-date': 'Year to date',
  'all-dates': 'All dates',
  custom: 'Custom',
}

/**
 * Where "all dates" starts.
 *
 * Far enough back that no set of books reaches it, and a real date rather than
 * an open-ended query so every report keeps the same shape — one range, two
 * ends, comparable against any other.
 */
export const EARLIEST_DATE: CalendarDate = '1900-01-01'

/** Monday-first, which is how a business week is read nearly everywhere. */
function startOfWeek(date: CalendarDate): CalendarDate {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  // getUTCDay is 0 for Sunday; shift so Monday is 0.
  return addDays(date, -((day + 6) % 7))
}

export type Period = { from: CalendarDate; to: CalendarDate }

function periodIndexInYear(date: CalendarDate, yearStart: CalendarDate, yearEnd: CalendarDate): number {
  for (let i = 0; i < 12; i++) {
    const from = addMonths(yearStart, i)
    const to = i === 11 ? yearEnd : dayBefore(addMonths(yearStart, i + 1))
    if (date >= from && date <= to) return i
  }
  return 0
}

function anniversaryPeriodAt(
  yearStart: CalendarDate,
  yearEnd: CalendarDate,
  index: number,
): Period {
  const from = addMonths(yearStart, index)
  const to = index === 11 ? yearEnd : dayBefore(addMonths(yearStart, index + 1))
  return { from, to }
}

/** The anniversary (or calendar-month) period containing `date`. */
function fiscalMonthOf(date: CalendarDate, start: FiscalYearStart): Period {
  if (start.day === 1) {
    return { from: startOfMonth(date), to: endOfMonth(date) }
  }
  const fy = fiscalYearOf(date, start)
  const year = fiscalYearRange(fy, start)
  const index = periodIndexInYear(date, year.start, year.end)
  return anniversaryPeriodAt(year.start, year.end, index)
}

function quarterOf(date: CalendarDate, start: FiscalYearStart): Period {
  const fy = fiscalYearOf(date, start)
  const year = fiscalYearRange(fy, start)
  if (start.day === 1) {
    const month = Number(date.slice(5, 7))
    // Quarters run from the start of the fiscal year, not from January, so a
    // business whose year starts in April reports April–June as Q1.
    const offset = (month - start.month + 12) % 12
    const from = addMonths(startOfMonth(date), -(offset % 3))
    return { from, to: endOfMonth(addMonths(from, 2)) }
  }
  const index = periodIndexInYear(date, year.start, year.end)
  const qStart = Math.floor(index / 3) * 3
  return {
    from: addMonths(year.start, qStart),
    to: qStart + 2 === 11 ? year.end : dayBefore(addMonths(year.start, qStart + 3)),
  }
}

/** Named fiscal quarter 1–4 within a labelled fiscal year. */
export function fiscalQuarterRange(
  fiscalYear: number,
  quarter: 1 | 2 | 3 | 4,
  fiscalYearStart: FiscalYearStart | number,
  startDay = 1,
): Period {
  const start = normalizeFiscalYearStart(fiscalYearStart, startDay)
  const year = fiscalYearRange(fiscalYear, start)
  const qStart = (quarter - 1) * 3
  if (start.day === 1) {
    const from = addMonths(year.start, qStart)
    return { from, to: endOfMonth(addMonths(from, 2)) }
  }
  return {
    from: addMonths(year.start, qStart),
    to: qStart + 2 === 11 ? year.end : dayBefore(addMonths(year.start, qStart + 3)),
  }
}

export function resolvePeriod(
  key: PeriodKey,
  today: CalendarDate,
  fiscalYearStart: FiscalYearStart | number,
  custom?: Partial<Period>,
  startDay = 1,
): Period {
  const start = normalizeFiscalYearStart(fiscalYearStart, startDay)
  // Support legacy resolvePeriod(key, today, month, custom) and
  // resolvePeriod(key, today, month, undefined, day) — when the 4th arg is a
  // number it was never used that way; custom is always an object or undefined.
  const thisFy = fiscalYearOf(today, start)
  const thisYear = fiscalYearRange(thisFy, start)

  switch (key) {
    case 'today':
      return { from: today, to: today }
    case 'this-week': {
      const weekStart = startOfWeek(today)
      return { from: weekStart, to: addDays(weekStart, 6) }
    }
    case 'last-week': {
      const weekStart = addDays(startOfWeek(today), -7)
      return { from: weekStart, to: addDays(weekStart, 6) }
    }
    case 'all-dates':
      return { from: EARLIEST_DATE, to: today }
    case 'this-month':
      return fiscalMonthOf(today, start)
    case 'last-month': {
      if (start.day === 1) {
        const previous = addMonths(startOfMonth(today), -1)
        return { from: previous, to: endOfMonth(previous) }
      }
      const current = fiscalMonthOf(today, start)
      const prevEnd = dayBefore(current.from)
      return fiscalMonthOf(prevEnd, start)
    }
    case 'this-quarter':
      return quarterOf(today, start)
    case 'last-quarter': {
      const current = quarterOf(today, start)
      return {
        from: addMonths(current.from, -3),
        to: dayBefore(current.from),
      }
    }
    case 'fy-q1':
      return fiscalQuarterRange(thisFy, 1, start)
    case 'fy-q2':
      return fiscalQuarterRange(thisFy, 2, start)
    case 'fy-q3':
      return fiscalQuarterRange(thisFy, 3, start)
    case 'fy-q4':
      return fiscalQuarterRange(thisFy, 4, start)
    case 'last-fy-q1':
      return fiscalQuarterRange(thisFy - 1, 1, start)
    case 'last-fy-q2':
      return fiscalQuarterRange(thisFy - 1, 2, start)
    case 'last-fy-q3':
      return fiscalQuarterRange(thisFy - 1, 3, start)
    case 'last-fy-q4':
      return fiscalQuarterRange(thisFy - 1, 4, start)
    case 'this-fiscal-year':
      return { from: thisYear.start, to: thisYear.end }
    case 'last-fiscal-year': {
      const previous = fiscalYearRange(thisFy - 1, start)
      return { from: previous.start, to: previous.end }
    }
    case 'year-to-date':
      return { from: thisYear.start, to: today }
    case 'custom':
      return { from: custom?.from ?? thisYear.start, to: custom?.to ?? today }
  }
}

/** The same length of period, immediately before it. Used for comparatives. */
export function priorPeriod(period: Period): Period {
  const from = new Date(`${period.from}T00:00:00Z`)
  const to = new Date(`${period.to}T00:00:00Z`)
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  return { from: addDays(period.from, -days), to: addDays(period.from, -1) }
}

/** The same period one year earlier, which is the comparison people expect. */
export function priorYear(period: Period): Period {
  return { from: addMonths(period.from, -12), to: addMonths(period.to, -12) }
}

export const isPeriodKey = (value: unknown): value is PeriodKey =>
  typeof value === 'string' && value in PERIOD_LABELS

import {
  addDays,
  addMonths,
  endOfMonth,
  fiscalYearOf,
  fiscalYearRange,
  startOfMonth,
  type CalendarDate,
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

function quarterOf(date: CalendarDate, fiscalYearStartMonth: number): Period {
  const month = Number(date.slice(5, 7))
  // Quarters run from the start of the fiscal year, not from January, so a
  // business whose year starts in April reports April–June as Q1.
  const offset = (month - fiscalYearStartMonth + 12) % 12
  const start = addMonths(startOfMonth(date), -(offset % 3))
  return { from: start, to: endOfMonth(addMonths(start, 2)) }
}

/** Named fiscal quarter 1–4 within a labelled fiscal year. */
export function fiscalQuarterRange(
  fiscalYear: number,
  quarter: 1 | 2 | 3 | 4,
  fiscalYearStartMonth: number,
): Period {
  const year = fiscalYearRange(fiscalYear, fiscalYearStartMonth)
  const start = addMonths(year.start, (quarter - 1) * 3)
  return { from: start, to: endOfMonth(addMonths(start, 2)) }
}

export function resolvePeriod(
  key: PeriodKey,
  today: CalendarDate,
  fiscalYearStartMonth: number,
  custom?: Partial<Period>,
): Period {
  const thisFy = fiscalYearOf(today, fiscalYearStartMonth)
  const thisYear = fiscalYearRange(thisFy, fiscalYearStartMonth)

  switch (key) {
    case 'today':
      return { from: today, to: today }
    case 'this-week': {
      const start = startOfWeek(today)
      return { from: start, to: addDays(start, 6) }
    }
    case 'last-week': {
      const start = addDays(startOfWeek(today), -7)
      return { from: start, to: addDays(start, 6) }
    }
    case 'all-dates':
      return { from: EARLIEST_DATE, to: today }
    case 'this-month':
      return { from: startOfMonth(today), to: endOfMonth(today) }
    case 'last-month': {
      const previous = addMonths(startOfMonth(today), -1)
      return { from: previous, to: endOfMonth(previous) }
    }
    case 'this-quarter':
      return quarterOf(today, fiscalYearStartMonth)
    case 'last-quarter': {
      const current = quarterOf(today, fiscalYearStartMonth)
      const start = addMonths(current.from, -3)
      return { from: start, to: addDays(current.from, -1) }
    }
    case 'fy-q1':
      return fiscalQuarterRange(thisFy, 1, fiscalYearStartMonth)
    case 'fy-q2':
      return fiscalQuarterRange(thisFy, 2, fiscalYearStartMonth)
    case 'fy-q3':
      return fiscalQuarterRange(thisFy, 3, fiscalYearStartMonth)
    case 'fy-q4':
      return fiscalQuarterRange(thisFy, 4, fiscalYearStartMonth)
    case 'last-fy-q1':
      return fiscalQuarterRange(thisFy - 1, 1, fiscalYearStartMonth)
    case 'last-fy-q2':
      return fiscalQuarterRange(thisFy - 1, 2, fiscalYearStartMonth)
    case 'last-fy-q3':
      return fiscalQuarterRange(thisFy - 1, 3, fiscalYearStartMonth)
    case 'last-fy-q4':
      return fiscalQuarterRange(thisFy - 1, 4, fiscalYearStartMonth)
    case 'this-fiscal-year':
      return { from: thisYear.start, to: thisYear.end }
    case 'last-fiscal-year': {
      const previous = fiscalYearRange(thisFy - 1, fiscalYearStartMonth)
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

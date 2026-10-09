/**
 * Transaction dates are calendar dates, not instants. An invoice dated
 * 31 January must be in January's period for a user in Nairobi and a user in
 * Los Angeles alike, so they are stored as Postgres `date` and handled here as
 * `YYYY-MM-DD` strings anchored to UTC midnight.
 *
 * System timestamps (createdAt, postedAt, audit) are the opposite: real instants,
 * stored as timestamptz, and are not this module's concern.
 */
export type CalendarDate = string // YYYY-MM-DD

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isCalendarDate(value: string): value is CalendarDate {
  if (!ISO_DATE.test(value)) return false
  const d = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** Parse a calendar date into the UTC-midnight Date that Prisma writes to a `date` column. */
export function toDate(value: CalendarDate): Date {
  if (!isCalendarDate(value)) throw new Error(`Invalid calendar date: ${value}`)
  return new Date(`${value}T00:00:00.000Z`)
}

/** Read a Prisma `date` column back as a calendar date. */
export function toCalendarDate(value: Date): CalendarDate {
  return value.toISOString().slice(0, 10)
}

/** "Today" in the organisation's timezone — not the server's. */
export function today(timeZone = 'UTC'): CalendarDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const d = toDate(date)
  d.setUTCDate(d.getUTCDate() + days)
  return toCalendarDate(d)
}

export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const d = toDate(date)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  // Clamp: 31 January + 1 month is 28/29 February, not 2/3 March.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return toCalendarDate(d)
}

export function startOfMonth(date: CalendarDate): CalendarDate {
  return `${date.slice(0, 7)}-01`
}

export function endOfMonth(date: CalendarDate): CalendarDate {
  const d = toDate(date)
  return toCalendarDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))
}

export const compareDates = (a: CalendarDate, b: CalendarDate): number =>
  a < b ? -1 : a > b ? 1 : 0

export const isBefore = (a: CalendarDate, b: CalendarDate) => a < b
export const isAfter = (a: CalendarDate, b: CalendarDate) => a > b
export const isWithin = (d: CalendarDate, start: CalendarDate, end: CalendarDate) =>
  d >= start && d <= end

/**
 * The fiscal year a date falls in, given the organisation's start month.
 * A year starting in April is labelled by the calendar year it *begins* in.
 */
export function fiscalYearOf(date: CalendarDate, startMonth: number): number {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  return month >= startMonth ? year : year - 1
}

export function fiscalYearRange(
  fiscalYear: number,
  startMonth: number,
): { start: CalendarDate; end: CalendarDate } {
  const start = `${fiscalYear}-${String(startMonth).padStart(2, '0')}-01`
  return { start, end: endOfMonth(addMonths(start, 11)) }
}

export function formatDate(date: CalendarDate, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(toDate(date))
}

/** The calendar day of a real instant, as YYYY-MM-DD in `timeZone`. */
export function calendarDateInZone(value: Date, timeZone = 'UTC'): CalendarDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

/**
 * Date and clock time of a real instant, in the reader's timezone.
 * "Oct 9, 2026, 11:05 AM" for en-US in Africa/Mogadishu (UTC+3).
 */
export function formatDateTime(value: Date, timeZone = 'UTC', locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

/**
 * A transaction date for lists, detail pages, and printed paper.
 *
 * `date` is the business calendar day. `instant`, when the row stores one
 * (createdAt, openedAt, postedAt), supplies the clock — but only when that
 * instant falls on `date` in `timeZone`. A date-only column, or a document
 * dated on a different day from when it was typed, stays "Oct 9, 2026" with
 * no invented midnight. A till sale created at 11:05 in Mogadishu reads
 * "Oct 9, 2026, 11:05 AM".
 */
export function formatTransactionDate(
  date: CalendarDate,
  instant?: Date | null,
  timeZone = 'UTC',
  locale = 'en-US',
): string {
  if (
    instant instanceof Date &&
    !Number.isNaN(instant.getTime()) &&
    calendarDateInZone(instant, timeZone) === date
  ) {
    return formatDateTime(instant, timeZone, locale)
  }
  return formatDate(date, locale)
}

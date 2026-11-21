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
 * Anniversary the fiscal year opens on (month 1–12, day 1–31).
 * Day 1 keeps classic calendar-month periods; any other day uses
 * anniversary spans (e.g. 20 Apr → 19 May).
 */
export type FiscalYearStart = { month: number; day: number }

/** Accept a full start object or the legacy month-only number (day defaults to 1). */
export function normalizeFiscalYearStart(
  start: FiscalYearStart | number,
  day = 1,
): FiscalYearStart {
  if (typeof start === 'number') return { month: start, day }
  return { month: start.month, day: start.day }
}

/** Read the anniversary from an organisation (or fixture) row. */
export function fiscalYearStartFrom(org: {
  fiscalYearStartMonth: number
  fiscalYearStartDay?: number | null
}): FiscalYearStart {
  return { month: org.fiscalYearStartMonth, day: org.fiscalYearStartDay ?? 1 }
}

/** Clamp day into the real length of that calendar month (Feb 29 → 28 in non-leap). */
export function anniversaryOn(year: number, month: number, day: number): CalendarDate {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const clamped = Math.min(Math.max(1, day), lastDay)
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`
}

export function dayBefore(date: CalendarDate): CalendarDate {
  return addDays(date, -1)
}

/**
 * Move an anniversary date forward/back by N months, preserving the intended
 * day-of-month with clamping (31 Jan + 1 month → 28/29 Feb).
 */
export function addAnniversaryMonths(date: CalendarDate, months: number): CalendarDate {
  return addMonths(date, months)
}

/**
 * The fiscal year a date falls in.
 * A year starting on M/D is labelled by the calendar year it *begins* in.
 */
export function fiscalYearOf(
  date: CalendarDate,
  start: FiscalYearStart | number,
  day = 1,
): number {
  const { month: startMonth, day: startDay } = normalizeFiscalYearStart(start, day)
  const year = Number(date.slice(0, 4))
  const openThisYear = anniversaryOn(year, startMonth, startDay)
  return date >= openThisYear ? year : year - 1
}

export function fiscalYearRange(
  fiscalYear: number,
  start: FiscalYearStart | number,
  day = 1,
): { start: CalendarDate; end: CalendarDate } {
  const { month: startMonth, day: startDay } = normalizeFiscalYearStart(start, day)
  const startDate = anniversaryOn(fiscalYear, startMonth, startDay)
  const nextOpen = anniversaryOn(fiscalYear + 1, startMonth, startDay)
  return { start: startDate, end: dayBefore(nextOpen) }
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
 * Build a real instant from a calendar date and HH:mm clock in `timeZone`.
 * Used for meetings and appointments that people enter in local wall time.
 */
export function zonedInstant(date: CalendarDate, time: string, timeZone: string): Date {
  if (!isCalendarDate(date)) throw new Error(`Invalid calendar date: ${date}`)
  const clock = /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '00:00'
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = clock.split(':').map(Number)
  const guess = new Date(Date.UTC(year!, (month ?? 1) - 1, day, hour, minute, 0))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(guess)
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour') % 24,
    read('minute'),
    read('second'),
  )
  return new Date(guess.getTime() - (asUtc - guess.getTime()))
}

/** HH:mm of an instant in `timeZone`. */
export function clockInZone(value: Date, timeZone = 'UTC'): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
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

/**
 * Same wording as the on-screen MerchantInvoice paper ("20 October 2026, 7:35 PM")
 * so PDF download and Print stay one document.
 */
export function formatLongTransactionDate(
  date: CalendarDate,
  instant?: Date | null,
  timeZone = 'UTC',
): string {
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(toDate(date))
  if (
    !(instant instanceof Date) ||
    Number.isNaN(instant.getTime()) ||
    calendarDateInZone(instant, timeZone) !== date
  ) {
    return day
  }
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant)
  return `${day}, ${time}`
}

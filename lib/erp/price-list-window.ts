import { toCalendarDate, type CalendarDate } from '@/lib/date'

/** Inclusive date window. Null start or end is unbounded. */
export function isDateWindowActive(
  asOf: CalendarDate | Date,
  startsOn: Date | string | null | undefined,
  endsOn: Date | string | null | undefined,
): boolean {
  const day = typeof asOf === 'string' ? asOf : toCalendarDate(asOf)
  if (startsOn) {
    const start = typeof startsOn === 'string' ? startsOn.slice(0, 10) : toCalendarDate(startsOn)
    if (day < start) return false
  }
  if (endsOn) {
    const end = typeof endsOn === 'string' ? endsOn.slice(0, 10) : toCalendarDate(endsOn)
    if (day > end) return false
  }
  return true
}

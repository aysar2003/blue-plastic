import type { CalendarDate } from '@/lib/date'

export type BalanceAlertKind = 'reminder' | 'reached'

export type BalanceAlert = {
  customerId: string
  name: string
  amount: string
  kind: BalanceAlertKind
  when: string
  reminderDays: number
}

/** The balance moment in the organisation's timezone. */
export function balanceMoment(date: CalendarDate, time: string | null, timeZone: string): Date {
  const clock = time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '00:00'
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = clock.split(':').map(Number)
  const guess = new Date(Date.UTC(year!, (month ?? 1) - 1, day, hour, minute, 0))
  const offset = timezoneOffset(guess, timeZone)
  return new Date(guess.getTime() - offset)
}

/**
 * `reminder` once the chosen 3, 5, or 7 days have started.
 * `reached` once the balance time itself has arrived.
 * `waiting` until then.
 */
export function balanceAlertKind(
  now: number,
  due: number,
  reminderDays: number,
): BalanceAlertKind | 'waiting' {
  const remindAt = due - reminderDays * 86_400_000
  if (now < remindAt) return 'waiting'
  return now >= due ? 'reached' : 'reminder'
}

function timezoneOffset(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour') % 24, read('minute'), read('second'))
  return asUtc - date.getTime()
}

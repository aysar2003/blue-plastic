import { clockInZone, today, toDate, zonedInstant, type CalendarDate } from '@/lib/date'

/**
 * Collection clock for overdue checks.
 *
 * Overdue is taken from the promise written when the customer or vendor was
 * registered (balance date + time, else agreement date). A later payment
 * promise on the paper still wins. The document due date stays for work due
 * and is only the fallback when no registration promise exists.
 */
export type OverdueClock = {
  now?: Date
  timeZone?: string
}

export type CollectionRow = {
  status?: string
  excludeFromOverdue?: boolean | null
  dueDate?: CalendarDate | Date | null
  promisedDate?: CalendarDate | Date | null
  due?: CalendarDate | null
  date?: CalendarDate | Date | null
  partyBalanceDate?: CalendarDate | Date | null
  partyAgreementDate?: CalendarDate | Date | null
  partyBalanceTime?: string | null
}

export function overdueClock(timeZone: string, now = new Date()): OverdueClock & {
  asOf: CalendarDate
  asOfDate: Date
  nowTime: string
} {
  return {
    now,
    timeZone,
    asOf: today(timeZone),
    asOfDate: toDate(today(timeZone)),
    nowTime: clockInZone(now, timeZone),
  }
}

/** Date used to decide overdue — not the work due date shown on the paper. */
export function collectionDueDate(row: CollectionRow): CalendarDate | null {
  const promised = toIso(row.promisedDate)
  if (promised) return promised
  const party = toIso(row.partyBalanceDate) ?? toIso(row.partyAgreementDate)
  if (party) return party
  const due = toIso(row.dueDate) ?? row.due ?? null
  if (due) return due
  return toIso(row.date)
}

/** Clock time of the registration promise, when that date is the collection date. */
export function collectionDueTime(row: CollectionRow): string | null {
  if (toIso(row.promisedDate)) return null
  const balance = toIso(row.partyBalanceDate)
  if (balance && row.partyBalanceTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.partyBalanceTime)) {
    return row.partyBalanceTime
  }
  return null
}

/** True when an open invoice or bill should appear on overdue lists and the overdue band. */
export function isCollectionOverdue(row: CollectionRow, asOf: CalendarDate, clock?: OverdueClock): boolean {
  if (row.excludeFromOverdue) return false
  if (row.status && row.status !== 'OPEN' && row.status !== 'PARTIAL') return false
  const due = collectionDueDate(row)
  if (!due) return false
  if (due < asOf) return true
  if (due > asOf) return false
  const time = collectionDueTime(row)
  if (!time || !clock?.timeZone) return false
  const instant = zonedInstant(due, time, clock.timeZone)
  return (clock.now ?? new Date()).getTime() >= instant.getTime()
}

export function partyFromContact(party?: {
  balanceDate?: CalendarDate | Date | null
  agreementDate?: CalendarDate | Date | null
  balanceTime?: string | null
} | null): {
  partyBalanceDate: CalendarDate | null
  partyAgreementDate: CalendarDate | null
  partyBalanceTime: string | null
} {
  if (!party) {
    return { partyBalanceDate: null, partyAgreementDate: null, partyBalanceTime: null }
  }
  return {
    partyBalanceDate: toIso(party.balanceDate),
    partyAgreementDate: toIso(party.agreementDate),
    partyBalanceTime: party.balanceTime ?? null,
  }
}

/**
 * Prisma `OR` that marks a document overdue from the registration promise,
 * then the paper due date when that promise was never written.
 */
export function documentOverdueOr(args: {
  asOf: Date
  nowTime: string
  party: 'customer' | 'vendor'
  withPromisedDate?: boolean
}): Array<Record<string, unknown>> {
  const partyPast = {
    [args.party]: {
      OR: [
        { balanceDate: { lt: args.asOf } },
        {
          AND: [
            { balanceDate: args.asOf },
            { NOT: { balanceTime: null } },
            { balanceTime: { lte: args.nowTime } },
          ],
        },
        { AND: [{ balanceDate: null }, { agreementDate: { lt: args.asOf } }] },
      ],
    },
  }
  const partyMissing = { [args.party]: { balanceDate: null, agreementDate: null } }
  const duePast = { dueDate: { lt: args.asOf } }

  if (args.withPromisedDate) {
    return [
      { promisedDate: { lt: args.asOf } },
      { AND: [{ promisedDate: null }, partyPast] },
      { AND: [{ promisedDate: null }, partyMissing, duePast] },
    ]
  }
  return [partyPast, { AND: [partyMissing, duePast] }]
}

function toIso(value: CalendarDate | Date | null | undefined): CalendarDate | null {
  if (!value) return null
  if (typeof value === 'string') return value
  return value.toISOString().slice(0, 10)
}

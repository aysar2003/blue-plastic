import 'server-only'
import type { PeriodStatus } from '@prisma/client'

import {
  addMonths,
  dayBefore,
  fiscalYearOf,
  fiscalYearRange,
  normalizeFiscalYearStart,
  toDate,
  type CalendarDate,
  type FiscalYearStart,
} from '@/lib/date'
import type { Tx } from '@/server/db'
import { precondition } from '@/server/errors'

export type ResolvedPeriod = {
  id: string
  fiscalYearId: string
  periodNumber: number
  startDate: Date
  endDate: Date
  status: PeriodStatus
}

/**
 * Find the accounting period a date belongs to, creating the fiscal year and its
 * periods on first use.
 *
 * Generating lazily rather than asking a user to "open the year" removes a whole
 * class of support problem: nobody can be blocked from entering a transaction
 * because an administrative step was skipped. Closing a period is still a
 * deliberate act — it is only *opening* that happens by itself.
 */
export async function resolvePeriod(
  tx: Tx,
  orgId: string,
  fiscalYearStart: FiscalYearStart | number,
  date: CalendarDate,
  startDay = 1,
): Promise<ResolvedPeriod> {
  const start = normalizeFiscalYearStart(fiscalYearStart, startDay)
  const existing = await findPeriod(tx, orgId, date)
  if (existing) return existing

  await ensureFiscalYear(tx, orgId, start, fiscalYearOf(date, start))

  const created = await findPeriod(tx, orgId, date)
  if (!created) {
    throw precondition(`No accounting period could be created for ${date}.`)
  }
  return created
}

async function findPeriod(tx: Tx, orgId: string, date: CalendarDate): Promise<ResolvedPeriod | null> {
  return tx.accountingPeriod.findFirst({
    where: { orgId, startDate: { lte: toDate(date) }, endDate: { gte: toDate(date) } },
    select: {
      id: true,
      fiscalYearId: true,
      periodNumber: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  })
}

/**
 * Create a fiscal year and its thirteen periods if it does not exist.
 *
 * Period 0 is a single day, the day before the year opens. Opening balances land
 * there so they never sit inside a trading month and distort it — the January
 * profit and loss should show January's trading, not the balances the business
 * carried in with.
 *
 * Periods 1–12 are anniversary months: for a year opening on 20 Apr they run
 * 20 Apr–19 May, …, 20 Mar–19 Apr. When the start day is 1 they coincide with
 * calendar months (1 Apr–30 Apr, …).
 */
export async function ensureFiscalYear(
  tx: Tx,
  orgId: string,
  fiscalYearStart: FiscalYearStart | number,
  year: number,
  startDay = 1,
): Promise<{ id: string; year: number; created: boolean }> {
  const start = normalizeFiscalYearStart(fiscalYearStart, startDay)
  const existing = await tx.fiscalYear.findUnique({
    where: { orgId_year: { orgId, year } },
    select: { id: true, year: true },
  })
  if (existing) return { ...existing, created: false }

  const { start: open, end } = fiscalYearRange(year, start)

  const fiscalYear = await tx.fiscalYear.create({
    data: {
      orgId,
      year,
      startDate: toDate(open),
      endDate: toDate(end),
      periods: {
        create: [
          {
            orgId,
            periodNumber: 0,
            startDate: toDate(dayBefore(open)),
            endDate: toDate(dayBefore(open)),
          },
          ...Array.from({ length: 12 }, (_, index) => {
            const periodStart = addMonths(open, index)
            const periodEnd = index === 11 ? end : dayBefore(addMonths(open, index + 1))
            return {
              orgId,
              periodNumber: index + 1,
              startDate: toDate(periodStart),
              endDate: toDate(periodEnd),
            }
          }),
        ],
      },
    },
    select: { id: true, year: true },
  })

  return { ...fiscalYear, created: true }
}

/** The earliest date that can still be posted to, or null if every period is open. */
export async function earliestOpenDate(tx: Tx, orgId: string): Promise<Date | null> {
  const period = await tx.accountingPeriod.findFirst({
    where: { orgId, status: 'OPEN' },
    orderBy: { startDate: 'asc' },
    select: { startDate: true },
  })
  return period?.startDate ?? null
}

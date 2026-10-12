import 'server-only'
import type { PeriodStatus } from '@prisma/client'

import { fiscalYearOf, today, toCalendarDate } from '@/lib/date'
import type { ClosureKind, ClosureRow } from '@/lib/period-closures'
import { ensureFiscalYear } from '@/server/accounting/period'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition } from '@/server/errors'

export type { ClosureKind, ClosureRow }

export type PeriodRow = {
  id: string
  periodNumber: number
  startDate: Date
  endDate: Date
  status: PeriodStatus
  journalCount: number
  closedAt: Date | null
}

export type FiscalYearRow = {
  id: string
  year: number
  startDate: Date
  endDate: Date
  status: PeriodStatus
  periods: PeriodRow[]
}

export async function listFiscalYears(ctx: OrgContext): Promise<FiscalYearRow[]> {
  const years = await db.fiscalYear.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { year: 'desc' },
    select: {
      id: true,
      year: true,
      startDate: true,
      endDate: true,
      status: true,
      periods: {
        orderBy: { periodNumber: 'asc' },
        select: {
          id: true,
          periodNumber: true,
          startDate: true,
          endDate: true,
          status: true,
          closedAt: true,
          _count: { select: { journals: true } },
        },
      },
    },
  })

  return years.map((year) => ({
    ...year,
    periods: year.periods.map((period) => ({
      id: period.id,
      periodNumber: period.periodNumber,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      closedAt: period.closedAt,
      journalCount: period._count.journals,
    })),
  }))
}

/**
 * Create a fiscal year and its periods on demand.
 *
 * Posting also creates years lazily, so this exists only for the case of wanting
 * to see next year's calendar before anything has been posted into it.
 */
export async function createFiscalYear(ctx: OrgContext, year: number) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const result = await ensureFiscalYear(
      tx,
      ctx.orgId,
      ctx.organization.fiscalYearStartMonth,
      year,
    )

    if (result.created) {
      await writeAudit(
        tx,
        ctx,
        { entity: 'FiscalYear', entityId: result.id, action: 'CREATE', after: { year } },
        meta,
      )
    }

    return result
  })
}

/** One month, so its entries and reports can be opened underneath it. */
export async function find(ctx: OrgContext, id: string) {
  return db.accountingPeriod.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      periodNumber: true,
      startDate: true,
      endDate: true,
      status: true,
      fiscalYear: { select: { year: true, status: true } },
    },
  })
}

/** Make sure the year containing today exists, so the periods page is never empty. */
export async function ensureCurrentFiscalYear(ctx: OrgContext) {
  const year = fiscalYearOf(today(ctx.organization.timeZone), ctx.organization.fiscalYearStartMonth)
  return db.$transaction((tx) =>
    ensureFiscalYear(tx, ctx.orgId, ctx.organization.fiscalYearStartMonth, year),
  )
}

/**
 * Close or reopen a period.
 *
 * Closing is a soft close: it stops postings, and someone with `period:reopen`
 * can undo it. A period cannot be closed while an earlier one is still open —
 * closing March while February accepts entries would leave the March figures
 * able to change without March ever being reopened.
 */
export async function setStatus(ctx: OrgContext, periodId: string, status: 'OPEN' | 'CLOSED') {
  const meta = await requestMeta()

  const period = await db.accountingPeriod.findFirst({
    where: { id: periodId, orgId: ctx.orgId },
    select: {
      id: true,
      status: true,
      periodNumber: true,
      startDate: true,
      endDate: true,
      fiscalYear: { select: { year: true } },
    },
  })
  if (!period) throw notFound('Accounting period')

  if (period.status === 'LOCKED') {
    throw precondition(
      'This period is locked by the year-end close and cannot be reopened from here.',
    )
  }

  if (status === 'CLOSED') {
    const earlierOpen = await db.accountingPeriod.findFirst({
      where: { orgId: ctx.orgId, status: 'OPEN', startDate: { lt: period.startDate } },
      orderBy: { startDate: 'asc' },
      select: { startDate: true, endDate: true },
    })
    if (earlierOpen) {
      throw precondition(
        `Close ${toCalendarDate(earlierOpen.startDate)} to ${toCalendarDate(earlierOpen.endDate)} first. ` +
          `Periods close in order, or a closed month can still change through an open earlier one.`,
      )
    }
  }

  if (status === 'OPEN') {
    const laterClosed = await db.accountingPeriod.findFirst({
      where: { orgId: ctx.orgId, status: { in: ['CLOSED', 'LOCKED'] }, startDate: { gt: period.startDate } },
      orderBy: { startDate: 'asc' },
      select: { startDate: true, endDate: true, status: true },
    })
    if (laterClosed) {
      throw precondition(
        `Reopen ${toCalendarDate(laterClosed.startDate)} to ${toCalendarDate(laterClosed.endDate)} first. ` +
          `Periods reopen in reverse order.`,
      )
    }
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status,
        closedAt: status === 'CLOSED' ? new Date() : null,
        closedById: status === 'CLOSED' ? ctx.userId : null,
      },
      select: { id: true, status: true, startDate: true, endDate: true },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'AccountingPeriod',
        entityId: periodId,
        action: status === 'CLOSED' ? 'CLOSE_PERIOD' : 'REOPEN_PERIOD',
        before: { status: period.status },
        after: {
          status,
          period: `${toCalendarDate(period.startDate)}..${toCalendarDate(period.endDate)}`,
        },
      },
      meta,
    )

    return updated
  })
}

/**
 * Every soft-closed month, completed closed quarter, and locked fiscal year —
 * current and prior years — so reports can pick the last close or any earlier one.
 */
export async function listClosures(
  ctx: OrgContext,
  filter?: { kind?: ClosureKind },
): Promise<ClosureRow[]> {
  const years = await listFiscalYears(ctx)
  const rows: ClosureRow[] = []

  for (const year of years) {
    const months = year.periods.filter((p) => p.periodNumber >= 1 && p.periodNumber <= 12)

    if (year.status === 'LOCKED') {
      rows.push({
        id: `year:${year.id}`,
        kind: 'year',
        label: `Fiscal year ${year.year}`,
        fiscalYear: year.year,
        sequence: null,
        from: toCalendarDate(year.startDate),
        to: toCalendarDate(year.endDate),
        status: 'LOCKED',
        closedAt: null,
      })
    }

    for (const quarter of [1, 2, 3, 4] as const) {
      const slice = months.filter(
        (p) => Math.ceil(p.periodNumber / 3) === quarter,
      )
      if (slice.length < 3) continue
      const allClosed = slice.every((p) => p.status === 'CLOSED' || p.status === 'LOCKED')
      if (!allClosed) continue
      const first = slice[0]!
      const last = slice[slice.length - 1]!
      const latestClose = slice
        .map((p) => p.closedAt)
        .filter((d): d is Date => Boolean(d))
        .sort((a, b) => b.getTime() - a.getTime())[0]
      rows.push({
        id: `quarter:${year.id}:q${quarter}`,
        kind: 'quarter',
        label: `FY ${year.year} — Q${quarter}`,
        fiscalYear: year.year,
        sequence: quarter,
        from: toCalendarDate(first.startDate),
        to: toCalendarDate(last.endDate),
        status: slice.every((p) => p.status === 'LOCKED') ? 'LOCKED' : 'CLOSED',
        closedAt: latestClose ? latestClose.toISOString() : null,
      })
    }

    for (const period of months) {
      if (period.status !== 'CLOSED' && period.status !== 'LOCKED') continue
      rows.push({
        id: `month:${period.id}`,
        kind: 'month',
        label: `${monthName(period.startDate)} ${year.year}`,
        fiscalYear: year.year,
        sequence: period.periodNumber,
        from: toCalendarDate(period.startDate),
        to: toCalendarDate(period.endDate),
        status: period.status,
        closedAt: period.closedAt ? period.closedAt.toISOString() : null,
      })
    }
  }

  const filtered = filter?.kind ? rows.filter((row) => row.kind === filter.kind) : rows
  return filtered.sort((a, b) => (a.to < b.to ? 1 : a.to > b.to ? -1 : 0))
}

/** Most recent closed span (prefer month, else quarter, else year). */
export async function latestClosure(ctx: OrgContext): Promise<ClosureRow | null> {
  const rows = await listClosures(ctx)
  return rows[0] ?? null
}

function monthName(date: Date): string {
  return date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
}

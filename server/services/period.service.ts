import 'server-only'
import type { PeriodStatus } from '@prisma/client'

import { fiscalYearOf, today, toCalendarDate } from '@/lib/date'
import { ensureFiscalYear } from '@/server/accounting/period'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition } from '@/server/errors'

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

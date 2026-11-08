import 'server-only'

import { Decimal } from '@/lib/money'
import { today } from '@/lib/date'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, validation } from '@/server/errors'

function dayBounds(businessDate: string, timeZone: string) {
  // businessDate is YYYY-MM-DD in org calendar; use UTC day window for POS timestamps.
  const start = new Date(`${businessDate}T00:00:00.000Z`)
  const end = new Date(`${businessDate}T23:59:59.999Z`)
  if (Number.isNaN(start.getTime())) throw validation('Invalid business date.')
  void timeZone
  return { start, end }
}

export async function preview(ctx: OrgContext, businessDate: string) {
  const { start, end } = dayBounds(businessDate, ctx.organization.timeZone)

  const orders = await db.posOrder.findMany({
    where: {
      orgId: ctx.orgId,
      createdAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      tipAmount: true,
      changeAmount: true,
      salesDocument: {
        select: { total: true, status: true, number: true },
      },
      session: {
        select: {
          id: true,
          expectedCashAtClose: true,
          closingCash: true,
          cashDifference: true,
          status: true,
        },
      },
    },
  })

  let salesTotal = new Decimal(0)
  let tipsTotal = new Decimal(0)
  let voided = 0
  for (const order of orders) {
    if (order.salesDocument.status === 'VOID') {
      voided += 1
      continue
    }
    salesTotal = salesTotal.plus(order.salesDocument.total.toString())
    tipsTotal = tipsTotal.plus(order.tipAmount.toString())
  }

  const sessions = await db.posSession.findMany({
    where: {
      orgId: ctx.orgId,
      OR: [
        { openedAt: { gte: start, lte: end } },
        { closedAt: { gte: start, lte: end } },
      ],
    },
    select: {
      id: true,
      status: true,
      expectedCashAtClose: true,
      closingCash: true,
      cashDifference: true,
      register: { select: { name: true } },
    },
  })

  return {
    businessDate,
    orderCount: orders.length,
    voided,
    salesTotal: salesTotal.toFixed(2),
    tipsTotal: tipsTotal.toFixed(2),
    sessions: sessions.map((session) => ({
      id: session.id,
      register: session.register.name,
      status: session.status,
      expectedCash: session.expectedCashAtClose?.toString() ?? null,
      countedCash: session.closingCash?.toString() ?? null,
      difference: session.cashDifference?.toString() ?? null,
    })),
  }
}

export async function closeNight(ctx: OrgContext, businessDate: string, memo?: string) {
  const summary = await preview(ctx, businessDate)
  const openSessions = summary.sessions.filter((s) => s.status === 'OPEN')
  if (openSessions.length > 0) {
    throw validation('Close every POS session before night audit.')
  }

  try {
    return await db.nightAuditRun.create({
      data: {
        orgId: ctx.orgId,
        businessDate: new Date(`${businessDate}T00:00:00.000Z`),
        status: 'CLOSED',
        summary,
        closedAt: new Date(),
        closedById: ctx.userId,
        memo: memo?.trim() || null,
      },
    })
  } catch {
    throw conflict('Night audit for that date already exists.')
  }
}

export async function listRuns(ctx: OrgContext) {
  return db.nightAuditRun.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { businessDate: 'desc' },
    take: 60,
  })
}

export async function getRun(ctx: OrgContext, id: string) {
  const run = await db.nightAuditRun.findFirst({
    where: { id, orgId: ctx.orgId },
  })
  if (!run) throw notFound('Night audit')
  return run
}

export function defaultBusinessDate(timeZone: string): string {
  return today(timeZone)
}

import 'server-only'

import type { LeaveRequestStatus } from '@prisma/client'

import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, money } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'

function inclusiveDays(from: CalendarDate, to: CalendarDate): Decimal {
  const a = toDate(from).getTime()
  const b = toDate(to).getTime()
  if (b < a) {
    throw validation('End date must be on or after the start date.', {
      dateTo: ['Must be on or after start'],
    })
  }
  const days = Math.floor((b - a) / 86_400_000) + 1
  return money(days)
}

export async function listTypes(ctx: OrgContext, opts: { activeOnly?: boolean } = {}) {
  return db.leaveType.findMany({
    where: {
      orgId: ctx.orgId,
      ...(opts.activeOnly ? { active: true } : {}),
    },
    orderBy: { name: 'asc' },
  })
}

export async function createType(
  ctx: OrgContext,
  input: { name: string; paid: boolean; daysPerYear: string; active?: boolean },
) {
  try {
    return await db.leaveType.create({
      data: {
        orgId: ctx.orgId,
        name: input.name,
        paid: input.paid,
        daysPerYear: money(input.daysPerYear),
        active: input.active ?? true,
      },
    })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      throw conflict('A leave type with that name already exists.')
    }
    throw error
  }
}

export async function updateType(
  ctx: OrgContext,
  id: string,
  input: { name: string; paid: boolean; daysPerYear: string; active?: boolean },
) {
  const existing = await db.leaveType.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!existing) throw notFound('Leave type')
  try {
    return await db.leaveType.update({
      where: { id },
      data: {
        name: input.name,
        paid: input.paid,
        daysPerYear: money(input.daysPerYear),
        ...(input.active === undefined ? {} : { active: input.active }),
      },
    })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      throw conflict('A leave type with that name already exists.')
    }
    throw error
  }
}

export async function removeType(ctx: OrgContext, id: string) {
  const existing = await db.leaveType.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!existing) throw notFound('Leave type')
  const used = await db.leaveRequest.count({ where: { leaveTypeId: id, orgId: ctx.orgId } })
  if (used > 0) {
    await db.leaveType.update({ where: { id }, data: { active: false } })
    return { id, archived: true }
  }
  await db.leaveType.delete({ where: { id } })
  return { id, archived: false }
}

export async function upsertAllocation(
  ctx: OrgContext,
  input: { employeeId: string; leaveTypeId: string; year: number; entitledDays: string },
) {
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!employee) throw validation('Employee not found.', { employeeId: ['Choose an employee'] })
  const leaveType = await db.leaveType.findFirst({
    where: { id: input.leaveTypeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!leaveType) throw validation('Leave type not found.', { leaveTypeId: ['Choose a type'] })

  return db.leaveAllocation.upsert({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        year: input.year,
      },
    },
    create: {
      orgId: ctx.orgId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      year: input.year,
      entitledDays: money(input.entitledDays),
    },
    update: { entitledDays: money(input.entitledDays) },
    include: {
      employee: { select: { id: true, name: true } },
      leaveType: { select: { id: true, name: true } },
    },
  })
}

export async function listAllocations(ctx: OrgContext, year: number) {
  return db.leaveAllocation.findMany({
    where: { orgId: ctx.orgId, year },
    include: {
      employee: { select: { id: true, name: true } },
      leaveType: { select: { id: true, name: true, paid: true } },
    },
    orderBy: [{ employee: { name: 'asc' } }, { leaveType: { name: 'asc' } }],
  })
}

async function usedDays(
  ctx: OrgContext,
  employeeId: string,
  leaveTypeId: string,
  year: number,
  excludeRequestId?: string,
) {
  const start = `${year}-01-01`
  const end = `${year}-12-31`
  const rows = await db.leaveRequest.findMany({
    where: {
      orgId: ctx.orgId,
      employeeId,
      leaveTypeId,
      status: 'APPROVED',
      dateFrom: { lte: toDate(end) },
      dateTo: { gte: toDate(start) },
      ...(excludeRequestId ? { NOT: { id: excludeRequestId } } : {}),
    },
    select: { days: true },
  })
  return rows.reduce((sum, row) => sum.plus(row.days), money(0))
}

export async function balance(
  ctx: OrgContext,
  employeeId: string,
  leaveTypeId: string,
  year: number,
) {
  const allocation = await db.leaveAllocation.findUnique({
    where: {
      employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year },
    },
  })
  const entitled = allocation ? money(allocation.entitledDays) : money(0)
  const used = await usedDays(ctx, employeeId, leaveTypeId, year)
  return {
    entitled: entitled.toFixed(4),
    used: used.toFixed(4),
    remaining: entitled.minus(used).toFixed(4),
  }
}

export async function listRequests(
  ctx: OrgContext,
  opts: { status?: LeaveRequestStatus | 'all' } = {},
) {
  const status = opts.status === 'all' || !opts.status ? undefined : opts.status
  const rows = await db.leaveRequest.findMany({
    where: {
      orgId: ctx.orgId,
      ...(status ? { status } : {}),
    },
    include: {
      employee: { select: { id: true, name: true, managerId: true } },
      leaveType: { select: { id: true, name: true, paid: true } },
      decidedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
  })
  return rows.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    managerId: row.employee.managerId,
    leaveTypeId: row.leaveTypeId,
    leaveTypeName: row.leaveType.name,
    paid: row.leaveType.paid,
    dateFrom: toCalendarDate(row.dateFrom),
    dateTo: toCalendarDate(row.dateTo),
    days: row.days.toFixed(4),
    reason: row.reason,
    status: row.status,
    decidedByName: row.decidedBy?.name ?? null,
    decisionNote: row.decisionNote,
    createdAt: row.createdAt,
  }))
}

export async function createRequest(
  ctx: OrgContext,
  input: {
    employeeId: string
    leaveTypeId: string
    dateFrom: CalendarDate
    dateTo: CalendarDate
    days?: string
    reason?: string | null
  },
) {
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, orgId: ctx.orgId, active: true },
    select: { id: true },
  })
  if (!employee) throw validation('Employee not found.', { employeeId: ['Choose an employee'] })
  const leaveType = await db.leaveType.findFirst({
    where: { id: input.leaveTypeId, orgId: ctx.orgId, active: true },
    select: { id: true },
  })
  if (!leaveType) throw validation('Leave type not found.', { leaveTypeId: ['Choose a type'] })

  const days = input.days ? money(input.days) : inclusiveDays(input.dateFrom, input.dateTo)
  if (days.lte(0)) throw validation('Days must be greater than zero.', { days: ['Required'] })

  const year = Number(input.dateFrom.slice(0, 4))
  const bal = await balance(ctx, input.employeeId, input.leaveTypeId, year)
  if (money(bal.remaining).minus(days).isNegative()) {
    throw precondition(`Not enough leave balance (remaining ${bal.remaining} days).`)
  }

  const row = await db.leaveRequest.create({
    data: {
      orgId: ctx.orgId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      dateFrom: toDate(input.dateFrom),
      dateTo: toDate(input.dateTo),
      days,
      reason: input.reason ?? null,
      status: 'PENDING',
      createdById: ctx.userId,
    },
  })
  return row
}

export async function decide(
  ctx: OrgContext,
  id: string,
  approve: boolean,
  decisionNote?: string | null,
) {
  const row = await db.leaveRequest.findFirst({
    where: { id, orgId: ctx.orgId },
    include: { leaveType: { select: { id: true } } },
  })
  if (!row) throw notFound('Leave request')
  if (row.status !== 'PENDING') {
    throw precondition('Only pending requests can be decided.')
  }

  if (approve) {
    const year = Number(toCalendarDate(row.dateFrom).slice(0, 4))
    const bal = await balance(ctx, row.employeeId, row.leaveTypeId, year)
    // Balance already excludes this request (still PENDING); check remaining.
    if (money(bal.remaining).minus(row.days).isNegative()) {
      throw precondition(`Not enough leave balance (remaining ${bal.remaining} days).`)
    }
  }

  return db.leaveRequest.update({
    where: { id },
    data: {
      status: approve ? 'APPROVED' : 'REFUSED',
      decidedById: ctx.userId,
      decidedAt: new Date(),
      decisionNote: decisionNote ?? null,
    },
  })
}

export async function cancel(ctx: OrgContext, id: string) {
  const row = await db.leaveRequest.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!row) throw notFound('Leave request')
  if (row.status !== 'PENDING' && row.status !== 'DRAFT') {
    throw precondition('Only pending or draft requests can be cancelled.')
  }
  return db.leaveRequest.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })
}

/** Approved unpaid leave days overlapping a period (for payroll). */
export async function unpaidLeaveDaysInPeriod(
  ctx: OrgContext,
  employeeId: string,
  periodStart: CalendarDate,
  periodEnd: CalendarDate,
) {
  const rows = await db.leaveRequest.findMany({
    where: {
      orgId: ctx.orgId,
      employeeId,
      status: 'APPROVED',
      leaveType: { paid: false },
      dateFrom: { lte: toDate(periodEnd) },
      dateTo: { gte: toDate(periodStart) },
    },
    select: { dateFrom: true, dateTo: true, days: true },
  })
  // Simple: sum request days that fall in range (full request days if overlapping).
  return rows.reduce((sum, row) => sum.plus(row.days), money(0))
}

import 'server-only'

import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { money } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

function hoursBetween(checkIn: Date | null, checkOut: Date | null): string | null {
  if (!checkIn || !checkOut) return null
  const ms = checkOut.getTime() - checkIn.getTime()
  if (ms <= 0) return null
  return money(ms / 3_600_000).toFixed(4)
}

function parseInstant(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    throw validation('Invalid date/time.', { checkIn: ['Use a valid date-time'] })
  }
  return d
}

export async function list(
  ctx: OrgContext,
  opts: { from: CalendarDate; to: CalendarDate; employeeId?: string },
) {
  const rows = await db.attendanceDay.findMany({
    where: {
      orgId: ctx.orgId,
      date: { gte: toDate(opts.from), lte: toDate(opts.to) },
      ...(opts.employeeId ? { employeeId: opts.employeeId } : {}),
    },
    include: {
      employee: { select: { id: true, name: true, department: true } },
    },
    orderBy: [{ date: 'desc' }, { employee: { name: 'asc' } }],
  })
  return rows.map((row) => ({
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    department: row.employee.department,
    date: toCalendarDate(row.date),
    checkIn: row.checkIn?.toISOString() ?? null,
    checkOut: row.checkOut?.toISOString() ?? null,
    workedHours: row.workedHours?.toFixed(4) ?? null,
    note: row.note,
    source: row.source,
  }))
}

export async function upsert(
  ctx: OrgContext,
  input: {
    employeeId: string
    date: CalendarDate
    checkIn?: string | null
    checkOut?: string | null
    workedHours?: string | null
    note?: string | null
  },
) {
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!employee) throw validation('Employee not found.', { employeeId: ['Choose an employee'] })

  const checkIn = parseInstant(input.checkIn)
  const checkOut = parseInstant(input.checkOut)
  let workedHours =
    input.workedHours && input.workedHours.trim() !== ''
      ? money(input.workedHours)
      : money(hoursBetween(checkIn, checkOut) ?? 0)
  if (!input.workedHours && !checkIn && !checkOut) {
    workedHours = money(0)
  }

  const row = await db.attendanceDay.upsert({
    where: {
      employeeId_date: {
        employeeId: input.employeeId,
        date: toDate(input.date),
      },
    },
    create: {
      orgId: ctx.orgId,
      employeeId: input.employeeId,
      date: toDate(input.date),
      checkIn,
      checkOut,
      workedHours: workedHours.isZero() && !input.workedHours ? null : workedHours,
      note: input.note ?? null,
      source: 'MANUAL',
    },
    update: {
      checkIn,
      checkOut,
      workedHours: workedHours.isZero() && !input.workedHours ? null : workedHours,
      note: input.note ?? null,
    },
    include: { employee: { select: { id: true, name: true } } },
  })

  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    date: toCalendarDate(row.date),
    workedHours: row.workedHours?.toFixed(4) ?? null,
  }
}

export async function remove(ctx: OrgContext, id: string) {
  const row = await db.attendanceDay.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!row) throw notFound('Attendance day')
  await db.attendanceDay.delete({ where: { id } })
}

export async function workedDaysInPeriod(
  ctx: OrgContext,
  employeeId: string,
  periodStart: CalendarDate,
  periodEnd: CalendarDate,
) {
  const rows = await db.attendanceDay.findMany({
    where: {
      orgId: ctx.orgId,
      employeeId,
      date: { gte: toDate(periodStart), lte: toDate(periodEnd) },
      OR: [{ workedHours: { gt: 0 } }, { checkIn: { not: null } }],
    },
    select: { id: true },
  })
  return rows.length
}

export async function workedHoursInPeriod(
  ctx: OrgContext,
  employeeId: string,
  periodStart: CalendarDate,
  periodEnd: CalendarDate,
) {
  const rows = await db.attendanceDay.findMany({
    where: {
      orgId: ctx.orgId,
      employeeId,
      date: { gte: toDate(periodStart), lte: toDate(periodEnd) },
    },
    select: { workedHours: true, checkIn: true },
  })
  let total = money(0)
  let attendedDays = 0
  for (const row of rows) {
    const hours = row.workedHours ? money(row.workedHours) : money(0)
    if (hours.gt(0) || row.checkIn) attendedDays += 1
    total = total.plus(hours)
  }
  return { hours: total, attendedDays }
}

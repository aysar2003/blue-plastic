import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'

import {
  addDays,
  calendarDateInZone,
  clockInZone,
  endOfMonth,
  startOfMonth,
  today,
  zonedInstant,
  type CalendarDate,
} from '@/lib/date'
import type { CalendarEventInput } from '@/lib/validation/calendar'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

export type CalendarEventRow = {
  id: string
  title: string
  description: string | null
  location: string | null
  kind: string
  startsAt: Date
  endsAt: Date
  allDay: boolean
  reminderMinutes: number | null
  customerId: string | null
  vendorId: string | null
  customerName: string | null
  vendorName: string | null
  createdByName: string
}

export type CalendarReminder = {
  id: string
  title: string
  kind: string
  when: string
  startsAt: Date
}

function bounds(input: CalendarEventInput, timeZone: string) {
  if (input.allDay) {
    const start = zonedInstant(input.date as CalendarDate, '00:00', timeZone)
    const end = zonedInstant(addDays(input.date as CalendarDate, 1), '00:00', timeZone)
    return { startsAt: start, endsAt: end }
  }
  const startsAt = zonedInstant(input.date as CalendarDate, input.startTime, timeZone)
  const endsAt = zonedInstant(input.date as CalendarDate, input.endTime, timeZone)
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw validation('End time must be after the start time.')
  }
  return { startsAt, endsAt }
}

function mapRow(row: {
  id: string
  title: string
  description: string | null
  location: string | null
  kind: string
  startsAt: Date
  endsAt: Date
  allDay: boolean
  reminderMinutes: number | null
  customerId: string | null
  vendorId: string | null
  customer: { displayName: string } | null
  vendor: { displayName: string } | null
  createdBy: { name: string }
}): CalendarEventRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    kind: row.kind,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    reminderMinutes: row.reminderMinutes,
    customerId: row.customerId,
    vendorId: row.vendorId,
    customerName: row.customer?.displayName ?? null,
    vendorName: row.vendor?.displayName ?? null,
    createdByName: row.createdBy.name,
  }
}

/** Events that overlap a month in the organisation's timezone. */
export async function listInMonth(ctx: OrgContext, month: CalendarDate): Promise<CalendarEventRow[]> {
  const zone = ctx.organization.timeZone
  const from = zonedInstant(startOfMonth(month), '00:00', zone)
  const to = zonedInstant(addDays(endOfMonth(month), 1), '00:00', zone)

  const rows = await db.calendarEvent.findMany({
    where: {
      orgId: ctx.orgId,
      startsAt: { lt: to },
      endsAt: { gt: from },
    },
    include: {
      customer: { select: { displayName: true } },
      vendor: { select: { displayName: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: [{ startsAt: 'asc' }, { title: 'asc' }],
  })

  return rows.map(mapRow)
}

export async function upcoming(ctx: OrgContext, limit = 12): Promise<CalendarEventRow[]> {
  const rows = await db.calendarEvent.findMany({
    where: {
      orgId: ctx.orgId,
      endsAt: { gte: new Date() },
    },
    include: {
      customer: { select: { displayName: true } },
      vendor: { select: { displayName: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { startsAt: 'asc' },
    take: limit,
  })
  return rows.map(mapRow)
}

/**
 * Events whose reminder window has opened and that have not been dismissed.
 * Shown in the shell next to balance reminders. Cached ~60s per org like stock alerts.
 */
export function dueReminders(ctx: OrgContext): Promise<CalendarReminder[]> {
  return cachedDueReminders(ctx.orgId, ctx.organization.timeZone)
}

const cachedDueReminders = cache((orgId: string, timeZone: string) =>
  unstable_cache(
    () => queryDueReminders(orgId, timeZone),
    ['calendar-reminders-v1', orgId, timeZone],
    { revalidate: 60 },
  )(),
)

async function queryDueReminders(orgId: string, timeZone: string): Promise<CalendarReminder[]> {
  const now = new Date()
  const horizon = new Date(now.getTime() + 14 * 86_400_000)
  const rows = await db.calendarEvent.findMany({
    where: {
      orgId,
      reminderMinutes: { not: null },
      reminderDismissedAt: null,
      startsAt: { lte: horizon },
      endsAt: { gte: now },
    },
    select: {
      id: true,
      title: true,
      kind: true,
      startsAt: true,
      allDay: true,
      reminderMinutes: true,
    },
    orderBy: { startsAt: 'asc' },
    take: 40,
  })

  const due: CalendarReminder[] = []
  for (const row of rows) {
    const lead = (row.reminderMinutes ?? 0) * 60_000
    if (now.getTime() < row.startsAt.getTime() - lead) continue
    due.push({
      id: row.id,
      title: row.title,
      kind: row.kind,
      startsAt: row.startsAt,
      when: row.allDay
        ? calendarDateInZone(row.startsAt, timeZone)
        : formatWhen(row.startsAt, timeZone),
    })
  }
  return due
}

function formatWhen(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

export async function create(ctx: OrgContext, input: CalendarEventInput) {
  const zone = ctx.organization.timeZone
  const { startsAt, endsAt } = bounds(input, zone)
  return db.calendarEvent.create({
    data: {
      orgId: ctx.orgId,
      title: input.title,
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      kind: input.kind,
      startsAt,
      endsAt,
      allDay: input.allDay,
      reminderMinutes: input.reminderMinutes ?? null,
      createdById: ctx.userId,
      customerId: input.customerId || null,
      vendorId: input.vendorId || null,
    },
  })
}

export async function update(ctx: OrgContext, id: string, input: CalendarEventInput) {
  const existing = await db.calendarEvent.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, startsAt: true, reminderMinutes: true },
  })
  if (!existing) throw notFound('Event')

  const zone = ctx.organization.timeZone
  const { startsAt, endsAt } = bounds(input, zone)
  const reminderChanged =
    existing.startsAt.getTime() !== startsAt.getTime() ||
    existing.reminderMinutes !== (input.reminderMinutes ?? null)

  return db.calendarEvent.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      kind: input.kind,
      startsAt,
      endsAt,
      allDay: input.allDay,
      reminderMinutes: input.reminderMinutes ?? null,
      customerId: input.customerId || null,
      vendorId: input.vendorId || null,
      ...(reminderChanged ? { reminderDismissedAt: null } : {}),
    },
  })
}

export async function remove(ctx: OrgContext, id: string) {
  const existing = await db.calendarEvent.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!existing) throw notFound('Event')
  await db.calendarEvent.delete({ where: { id } })
  return { id }
}

export async function dismissReminder(ctx: OrgContext, id: string) {
  const existing = await db.calendarEvent.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!existing) throw notFound('Event')
  await db.calendarEvent.update({
    where: { id },
    data: { reminderDismissedAt: new Date() },
  })
  return { id }
}

/** Form values for the edit dialog. */
export function toFormValues(row: CalendarEventRow, timeZone: string) {
  const date = calendarDateInZone(row.startsAt, timeZone)
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    location: row.location ?? '',
    kind: row.kind,
    date,
    startTime: row.allDay ? '09:00' : clockInZone(row.startsAt, timeZone),
    endTime: row.allDay ? '17:00' : clockInZone(row.endsAt, timeZone),
    allDay: row.allDay,
    reminderMinutes: row.reminderMinutes,
    customerId: row.customerId,
    vendorId: row.vendorId,
  }
}

export function defaultMonth(timeZone: string): CalendarDate {
  return startOfMonth(today(timeZone))
}

import 'server-only'

import { Prisma } from '@prisma/client'

import { Decimal } from '@/lib/money'
import { routingMinutes } from '@/lib/erp/verticals-p5'
import { addDays, toCalendarDate, toDate, today } from '@/lib/date'
import {
  capacityAfterExceptions,
  effectiveWeeklyCapacity,
  isWorkCenterOverloaded,
  loadPercent,
  weekdayIndexMon0,
} from '@/lib/erp/routing-capacity'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, validation } from '@/server/errors'

export async function listWorkCenters(ctx: OrgContext) {
  return db.workCenter.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    include: { store: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  })
}

function normalizeWeekdayCapacity(
  values: string[] | number[] | null | undefined,
): { byDay: number[] | null; weekly: Decimal } {
  if (!values || values.length === 0) {
    return { byDay: null, weekly: new Decimal(2400) }
  }
  if (values.length !== 7) {
    throw validation('Weekday capacity needs seven values (Mon–Sun minutes).')
  }
  const byDay = values.map((value) => {
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0) {
      throw validation('Weekday minutes must be zero or more.')
    }
    return Math.round(n * 10000) / 10000
  })
  const weekly = byDay.reduce((sum, n) => sum.plus(n), new Decimal(0))
  if (weekly.lessThanOrEqualTo(0)) {
    throw validation('Weekly capacity must be more than zero minutes.')
  }
  return { byDay, weekly }
}

export async function upsertWorkCenter(
  ctx: OrgContext,
  input: {
    id?: string
    name: string
    storeId?: string | null
    capacityMinutesPerWeek?: string
    /** Mon–Sun minutes. When set, becomes capacityByWeekday and weekly total. */
    capacityByWeekday?: string[] | number[] | null
  },
) {
  const name = input.name.trim()
  if (!name) throw validation('Work center name is required.')

  const weekday = input.capacityByWeekday
    ? normalizeWeekdayCapacity(input.capacityByWeekday)
    : null
  const capacity = weekday
    ? weekday.weekly
    : new Decimal(input.capacityMinutesPerWeek || '2400')
  if (capacity.lessThanOrEqualTo(0)) {
    throw validation('Weekly capacity must be more than zero minutes.')
  }

  if (input.storeId) {
    const store = await db.store.findFirst({
      where: { id: input.storeId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!store) throw notFound('Store')
  }

  const weekdayJson: Prisma.InputJsonValue | undefined = weekday?.byDay
    ? (weekday.byDay as Prisma.InputJsonValue)
    : undefined

  if (input.id) {
    const existing = await db.workCenter.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Work center')
    return db.workCenter.update({
      where: { id: existing.id },
      data: {
        name,
        storeId: input.storeId || null,
        capacityMinutesPerWeek: capacity,
        ...(weekdayJson !== undefined
          ? { capacityByWeekday: weekdayJson }
          : input.capacityByWeekday === null
            ? { capacityByWeekday: Prisma.DbNull }
            : {}),
      },
    })
  }

  try {
    return await db.workCenter.create({
      data: {
        orgId: ctx.orgId,
        name,
        storeId: input.storeId || null,
        capacityMinutesPerWeek: capacity,
        ...(weekdayJson !== undefined ? { capacityByWeekday: weekdayJson } : {}),
      },
    })
  } catch {
    throw conflict('Another work center already uses that name.')
  }
}

export async function listRouting(ctx: OrgContext, itemId: string) {
  const item = await db.item.findFirst({
    where: { id: itemId, orgId: ctx.orgId, deletedAt: null },
    select: { id: true, name: true },
  })
  if (!item) throw notFound('Item')

  const steps = await db.routingStep.findMany({
    where: { orgId: ctx.orgId, itemId },
    include: { workCenter: { select: { id: true, name: true } } },
    orderBy: { sequence: 'asc' },
  })

  return {
    item,
    steps,
    totalMinutes: routingMinutes(steps.map((step) => ({ minutes: step.minutes.toString() }))),
  }
}

export async function replaceRouting(
  ctx: OrgContext,
  input: {
    itemId: string
    steps: {
      name: string
      minutes: string
      notes?: string | null
      workCenterId?: string | null
    }[]
  },
) {
  const item = await db.item.findFirst({
    where: { id: input.itemId, orgId: ctx.orgId, deletedAt: null },
    select: { id: true },
  })
  if (!item) throw notFound('Item')

  const centerIds = [
    ...new Set(
      input.steps
        .map((step) => step.workCenterId)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (centerIds.length > 0) {
    const known = await db.workCenter.findMany({
      where: { orgId: ctx.orgId, id: { in: centerIds }, isActive: true },
      select: { id: true },
    })
    if (known.length !== centerIds.length) throw notFound('Work center')
  }

  for (const step of input.steps) {
    if (!step.name.trim()) throw validation('Each routing step needs a name.')
  }

  return db.$transaction(async (tx) => {
    await tx.routingStep.deleteMany({ where: { orgId: ctx.orgId, itemId: item.id } })
    if (input.steps.length === 0) return []
    await tx.routingStep.createMany({
      data: input.steps.map((step, index) => ({
        orgId: ctx.orgId,
        itemId: item.id,
        workCenterId: step.workCenterId || null,
        name: step.name.trim(),
        sequence: index,
        minutes: new Decimal(step.minutes || '0'),
        notes: step.notes?.trim() || null,
      })),
    })
    return tx.routingStep.findMany({
      where: { orgId: ctx.orgId, itemId: item.id },
      include: { workCenter: { select: { id: true, name: true } } },
      orderBy: { sequence: 'asc' },
    })
  })
}

/**
 * Open work-order demand (qty × routing minutes) vs work-center weekly capacity.
 */
export async function addWorkCenterException(
  ctx: OrgContext,
  input: { workCenterId: string; date: string; notes?: string | null },
) {
  const center = await db.workCenter.findFirst({
    where: { id: input.workCenterId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!center) throw notFound('Work center')
  const date = toDate(input.date)
  try {
    return await db.workCenterException.create({
      data: {
        orgId: ctx.orgId,
        workCenterId: center.id,
        date,
        kind: 'HOLIDAY',
        notes: input.notes?.trim() || null,
      },
      select: { id: true, date: true },
    })
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : ''
    if (code === 'P2002') throw conflict('That date is already an exception for this work center.')
    throw error
  }
}

export async function listWorkCenterExceptions(ctx: OrgContext) {
  return db.workCenterException.findMany({
    where: { orgId: ctx.orgId },
    include: { workCenter: { select: { id: true, name: true } } },
    orderBy: { date: 'asc' },
    take: 200,
  })
}

export async function capacityReport(ctx: OrgContext) {
  const asOf = today(ctx.organization.timeZone)
  const weekMonday = addDays(asOf, -weekdayIndexMon0(asOf))
  const weekSunday = addDays(weekMonday, 6)
  const [centers, openOrders, steps, exceptions] = await Promise.all([
    db.workCenter.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: {
        id: true,
        name: true,
        capacityMinutesPerWeek: true,
        capacityByWeekday: true,
        store: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
    db.workOrder.findMany({
      where: { orgId: ctx.orgId, status: { in: ['DRAFT', 'RELEASED'] } },
      select: { id: true, itemId: true, quantity: true, number: true },
      take: 500,
    }),
    db.routingStep.findMany({
      where: { orgId: ctx.orgId, workCenterId: { not: null } },
      select: {
        itemId: true,
        workCenterId: true,
        minutes: true,
      },
    }),
    db.workCenterException.findMany({
      where: {
        orgId: ctx.orgId,
        date: { gte: toDate(weekMonday), lte: toDate(weekSunday) },
      },
      select: { workCenterId: true, date: true },
    }),
  ])

  const demandByCenter = new Map<string, number>()
  const workOrdersByCenter = new Map<string, { id: string; number: string }[]>()
  const stepsByItem = new Map<string, { workCenterId: string; minutes: number }[]>()
  for (const step of steps) {
    if (!step.workCenterId) continue
    const list = stepsByItem.get(step.itemId) ?? []
    list.push({
      workCenterId: step.workCenterId,
      minutes: Number(step.minutes.toString()),
    })
    stepsByItem.set(step.itemId, list)
  }

  for (const order of openOrders) {
    const qty = Number(order.quantity.toString())
    if (!Number.isFinite(qty) || qty <= 0) continue
    for (const step of stepsByItem.get(order.itemId) ?? []) {
      const prior = demandByCenter.get(step.workCenterId) ?? 0
      demandByCenter.set(step.workCenterId, prior + qty * step.minutes)
      const woList = workOrdersByCenter.get(step.workCenterId) ?? []
      if (!woList.some((row) => row.id === order.id)) {
        woList.push({ id: order.id, number: order.number })
        workOrdersByCenter.set(step.workCenterId, woList)
      }
    }
  }

  const holidaysByCenter = new Map<string, string[]>()
  for (const row of exceptions) {
    const list = holidaysByCenter.get(row.workCenterId) ?? []
    list.push(toCalendarDate(row.date))
    holidaysByCenter.set(row.workCenterId, list)
  }

  return centers.map((center) => {
    const byDay = Array.isArray(center.capacityByWeekday)
      ? (center.capacityByWeekday as number[])
      : null
    const weekly = effectiveWeeklyCapacity(center.capacityMinutesPerWeek.toString(), byDay)
    const capacity = capacityAfterExceptions(
      weekly,
      byDay,
      holidaysByCenter.get(center.id) ?? [],
    )
    const demand = demandByCenter.get(center.id) ?? 0
    const overloaded = isWorkCenterOverloaded(demand, capacity)
    const openWorkOrders = overloaded ? (workOrdersByCenter.get(center.id) ?? []) : []
    return {
      id: center.id,
      name: center.name,
      storeName: center.store?.name ?? null,
      capacityMinutes: capacity.toFixed(2),
      capacityByWeekday: byDay,
      demandMinutes: demand.toFixed(2),
      loadPercent: loadPercent(demand, capacity),
      overloaded,
      holidayDates: holidaysByCenter.get(center.id) ?? [],
      openWorkOrders,
    }
  })
}

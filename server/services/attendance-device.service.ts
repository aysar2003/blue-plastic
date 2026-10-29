import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

import type { AttendanceDeviceKind, AttendancePunchKind } from '@prisma/client'

import { toCalendarDate, toDate } from '@/lib/date'
import { money } from '@/lib/money'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, unauthenticated, validation } from '@/server/errors'

function newToken() {
  return randomBytes(24).toString('base64url')
}

/** Fast lookup index: sha256 of token → compare candidates by bcrypt. */
function tokenLookup(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function listDevices(ctx: OrgContext) {
  const rows = await db.attendanceDevice.findMany({
    where: { orgId: ctx.orgId },
    include: {
      _count: { select: { userMaps: true, punches: true } },
    },
    orderBy: { name: 'asc' },
  })
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    active: row.active,
    externalKey: row.externalKey,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    userCount: row._count.userMaps,
    punchCount: row._count.punches,
  }))
}

export async function createDevice(
  ctx: OrgContext,
  input: { name: string; kind?: AttendanceDeviceKind; externalKey: string; active?: boolean },
) {
  const plain = newToken()
  const tokenHash = await hashPassword(plain)
  const row = await db.attendanceDevice.create({
    data: {
      orgId: ctx.orgId,
      name: input.name,
      kind: input.kind ?? 'GENERIC_HTTP',
      externalKey: input.externalKey,
      active: input.active ?? true,
      tokenHash,
    },
  })
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    externalKey: row.externalKey,
    /** Shown once — store securely on the device. */
    token: plain,
    tokenHint: tokenLookup(plain).slice(0, 8),
  }
}

export async function updateDevice(
  ctx: OrgContext,
  id: string,
  input: { name: string; kind: AttendanceDeviceKind; externalKey: string; active: boolean },
) {
  const existing = await db.attendanceDevice.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!existing) throw notFound('Device')
  const row = await db.attendanceDevice.update({
    where: { id },
    data: {
      name: input.name,
      kind: input.kind,
      externalKey: input.externalKey,
      active: input.active,
    },
  })
  return { id: row.id }
}

export async function rotateDeviceToken(ctx: OrgContext, id: string) {
  const existing = await db.attendanceDevice.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!existing) throw notFound('Device')
  const plain = newToken()
  await db.attendanceDevice.update({
    where: { id },
    data: { tokenHash: await hashPassword(plain) },
  })
  return { id, token: plain }
}

export async function removeDevice(ctx: OrgContext, id: string) {
  const existing = await db.attendanceDevice.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!existing) throw notFound('Device')
  await db.attendanceDevice.delete({ where: { id } })
}

export async function listDeviceUsers(ctx: OrgContext, deviceId: string) {
  const device = await db.attendanceDevice.findFirst({ where: { id: deviceId, orgId: ctx.orgId } })
  if (!device) throw notFound('Device')
  const rows = await db.attendanceDeviceUser.findMany({
    where: { orgId: ctx.orgId, deviceId },
    include: { employee: { select: { id: true, name: true } } },
    orderBy: { externalUserId: 'asc' },
  })
  return rows.map((row) => ({
    id: row.id,
    deviceId: row.deviceId,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    externalUserId: row.externalUserId,
  }))
}

export async function mapDeviceUser(
  ctx: OrgContext,
  input: { deviceId: string; employeeId: string; externalUserId: string },
) {
  const device = await db.attendanceDevice.findFirst({
    where: { id: input.deviceId, orgId: ctx.orgId },
  })
  if (!device) throw notFound('Device')
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, orgId: ctx.orgId },
  })
  if (!employee) throw validation('Employee not found.', { employeeId: ['Choose an employee'] })

  const row = await db.attendanceDeviceUser.upsert({
    where: {
      deviceId_externalUserId: {
        deviceId: input.deviceId,
        externalUserId: input.externalUserId,
      },
    },
    create: {
      orgId: ctx.orgId,
      deviceId: input.deviceId,
      employeeId: input.employeeId,
      externalUserId: input.externalUserId,
    },
    update: { employeeId: input.employeeId },
  })
  return { id: row.id }
}

export async function unmapDeviceUser(ctx: OrgContext, id: string) {
  const row = await db.attendanceDeviceUser.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!row) throw notFound('Device user map')
  await db.attendanceDeviceUser.delete({ where: { id } })
}

export async function listRecentPunches(ctx: OrgContext, opts: { deviceId?: string; take?: number } = {}) {
  const rows = await db.attendancePunch.findMany({
    where: {
      orgId: ctx.orgId,
      ...(opts.deviceId ? { deviceId: opts.deviceId } : {}),
    },
    include: {
      employee: { select: { id: true, name: true } },
      device: { select: { id: true, name: true } },
    },
    orderBy: { punchedAt: 'desc' },
    take: opts.take ?? 50,
  })
  return rows.map((row) => ({
    id: row.id,
    deviceId: row.deviceId,
    deviceName: row.device.name,
    employeeId: row.employeeId,
    employeeName: row.employee?.name ?? null,
    punchedAt: row.punchedAt.toISOString(),
    kind: row.kind,
    externalUserId: row.externalUserId,
    externalId: row.externalId,
  }))
}

async function findDeviceByToken(token: string) {
  const devices = await db.attendanceDevice.findMany({
    where: { active: true },
    select: { id: true, orgId: true, tokenHash: true, externalKey: true, name: true },
    take: 500,
  })
  for (const device of devices) {
    if (await verifyPassword(token, device.tokenHash)) return device
  }
  return null
}

function calendarDateFromInstant(d: Date) {
  return toCalendarDate(d)
}

async function rollupDay(orgId: string, employeeId: string, day: Date) {
  const start = toDate(toCalendarDate(day))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)

  const punches = await db.attendancePunch.findMany({
    where: {
      orgId,
      employeeId,
      punchedAt: { gte: start, lt: end },
    },
    orderBy: { punchedAt: 'asc' },
  })

  const ins = punches.filter((p) => p.kind === 'IN' || p.kind === 'UNKNOWN')
  const outs = punches.filter((p) => p.kind === 'OUT')
  const checkIn = punches[0]?.punchedAt ?? null
  const checkOut =
    outs.length > 0 ? outs[outs.length - 1]!.punchedAt : punches.length > 1 ? punches[punches.length - 1]!.punchedAt : null

  let workedHours = money(0)
  if (checkIn && checkOut && checkOut > checkIn) {
    workedHours = money((checkOut.getTime() - checkIn.getTime()) / 3_600_000)
  } else if (ins.length && outs.length) {
    // Pair sequential IN/OUT
    let i = 0
    let o = 0
    while (i < punches.length) {
      const a = punches[i]!
      if (a.kind === 'OUT') {
        i += 1
        continue
      }
      const b = punches.slice(i + 1).find((p) => p.kind === 'OUT' || p.kind === 'UNKNOWN')
      if (b && b.punchedAt > a.punchedAt) {
        workedHours = workedHours.plus(money((b.punchedAt.getTime() - a.punchedAt.getTime()) / 3_600_000))
        i = punches.indexOf(b) + 1
        o += 1
      } else {
        i += 1
      }
    }
  }

  const dayRow = await db.attendanceDay.upsert({
    where: {
      employeeId_date: { employeeId, date: start },
    },
    create: {
      orgId,
      employeeId,
      date: start,
      checkIn,
      checkOut,
      workedHours: workedHours.isZero() ? null : workedHours,
      source: 'DEVICE',
    },
    update: {
      checkIn,
      checkOut,
      workedHours: workedHours.isZero() ? null : workedHours,
      source: 'DEVICE',
    },
  })

  await db.attendancePunch.updateMany({
    where: {
      orgId,
      employeeId,
      punchedAt: { gte: start, lt: end },
    },
    data: { attendanceDayId: dayRow.id },
  })

  return dayRow
}

export async function ingestPunch(input: {
  token: string
  externalUserId: string
  punchedAt: string | Date
  kind?: AttendancePunchKind
  externalId?: string | null
  raw?: unknown
}) {
  const device = await findDeviceByToken(input.token)
  if (!device) throw unauthenticated('Invalid device token.')

  const punchedAt = typeof input.punchedAt === 'string' ? new Date(input.punchedAt) : input.punchedAt
  if (Number.isNaN(punchedAt.getTime())) {
    throw validation('Invalid punchedAt.', { punchedAt: ['ISO date-time required'] })
  }

  const map = await db.attendanceDeviceUser.findFirst({
    where: {
      orgId: device.orgId,
      deviceId: device.id,
      externalUserId: input.externalUserId,
    },
  })

  if (input.externalId) {
    const existing = await db.attendancePunch.findFirst({
      where: {
        orgId: device.orgId,
        deviceId: device.id,
        externalId: input.externalId,
      },
    })
    if (existing) {
      return { id: existing.id, duplicate: true as const, employeeId: existing.employeeId }
    }
  }

  const punch = await db.attendancePunch.create({
    data: {
      orgId: device.orgId,
      deviceId: device.id,
      employeeId: map?.employeeId ?? null,
      punchedAt,
      kind: input.kind ?? 'UNKNOWN',
      externalId: input.externalId ?? null,
      externalUserId: input.externalUserId,
      raw: input.raw === undefined ? undefined : (input.raw as object),
    },
  })

  await db.attendanceDevice.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date() },
  })

  if (map?.employeeId) {
    await rollupDay(device.orgId, map.employeeId, punchedAt)
  }

  return {
    id: punch.id,
    duplicate: false as const,
    employeeId: map?.employeeId ?? null,
    date: calendarDateFromInstant(punchedAt),
  }
}

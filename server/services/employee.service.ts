import 'server-only'

import type { EmploymentType, Prisma, WageType } from '@prisma/client'

import { toCalendarDate, toDate } from '@/lib/date'
import { money } from '@/lib/money'
import type { EmployeeInput, EmployeeUpdateInput } from '@/lib/validation/employee'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, validation } from '@/server/errors'

const SELECT = {
  id: true,
  name: true,
  jobTitle: true,
  department: true,
  photoUrl: true,
  workEmail: true,
  workPhone: true,
  mobile: true,
  workStreet: true,
  workCity: true,
  workCountry: true,
  privateStreet: true,
  privateCity: true,
  privateCountry: true,
  emergencyContact: true,
  emergencyPhone: true,
  skills: true,
  notes: true,
  active: true,
  employmentType: true,
  hiredAt: true,
  leftAt: true,
  managerId: true,
  userId: true,
  wageType: true,
  wageAmount: true,
  expenseAccountId: true,
  payableAccountId: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true } },
  manager: { select: { id: true, name: true, jobTitle: true } },
} satisfies Prisma.EmployeeSelect

export type EmployeeRow = {
  id: string
  name: string
  jobTitle: string | null
  department: string | null
  photoUrl: string | null
  workEmail: string | null
  workPhone: string | null
  mobile: string | null
  workStreet: string | null
  workCity: string | null
  workCountry: string | null
  privateStreet: string | null
  privateCity: string | null
  privateCountry: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  skills: string | null
  notes: string | null
  active: boolean
  employmentType: EmploymentType
  hiredAt: string | null
  leftAt: string | null
  managerId: string | null
  managerName: string | null
  managerJobTitle: string | null
  userId: string | null
  userName: string | null
  userEmail: string | null
  wageType: WageType
  wageAmount: string
  expenseAccountId: string | null
  payableAccountId: string | null
  createdAt: Date
  updatedAt: Date
}

export type ColleagueOption = {
  id: string
  name: string
  email: string
}

export type ManagerOption = {
  id: string
  name: string
  jobTitle: string | null
}

function mapRow(row: {
  id: string
  name: string
  jobTitle: string | null
  department: string | null
  photoUrl: string | null
  workEmail: string | null
  workPhone: string | null
  mobile: string | null
  workStreet: string | null
  workCity: string | null
  workCountry: string | null
  privateStreet: string | null
  privateCity: string | null
  privateCountry: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  skills: string | null
  notes: string | null
  active: boolean
  employmentType: EmploymentType
  hiredAt: Date | null
  leftAt: Date | null
  managerId: string | null
  userId: string | null
  wageType: WageType
  wageAmount: { toFixed: (digits: number) => string } | string
  expenseAccountId: string | null
  payableAccountId: string | null
  createdAt: Date
  updatedAt: Date
  user: { id: string; name: string; email: string } | null
  manager: { id: string; name: string; jobTitle: string | null } | null
}): EmployeeRow {
  return {
    id: row.id,
    name: row.name,
    jobTitle: row.jobTitle,
    department: row.department,
    photoUrl: row.photoUrl,
    workEmail: row.workEmail,
    workPhone: row.workPhone,
    mobile: row.mobile,
    workStreet: row.workStreet,
    workCity: row.workCity,
    workCountry: row.workCountry,
    privateStreet: row.privateStreet,
    privateCity: row.privateCity,
    privateCountry: row.privateCountry,
    emergencyContact: row.emergencyContact,
    emergencyPhone: row.emergencyPhone,
    skills: row.skills,
    notes: row.notes,
    active: row.active,
    employmentType: row.employmentType,
    hiredAt: row.hiredAt ? toCalendarDate(row.hiredAt) : null,
    leftAt: row.leftAt ? toCalendarDate(row.leftAt) : null,
    managerId: row.managerId,
    managerName: row.manager?.name ?? null,
    managerJobTitle: row.manager?.jobTitle ?? null,
    userId: row.userId,
    userName: row.user?.name ?? null,
    userEmail: row.user?.email ?? null,
    wageType: row.wageType,
    wageAmount: typeof row.wageAmount === 'string' ? row.wageAmount : row.wageAmount.toFixed(4),
    expenseAccountId: row.expenseAccountId,
    payableAccountId: row.payableAccountId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function assertUserAvailable(ctx: OrgContext, userId: string | null, excludeId?: string) {
  if (!userId) return null
  const member = await db.membership.findFirst({
    where: { orgId: ctx.orgId, userId, status: 'ACTIVE' },
    select: { userId: true },
  })
  if (!member) {
    throw validation('That person is not an active user on this company.', {
      userId: ['Choose someone on this company'],
    })
  }
  const taken = await db.employee.findFirst({
    where: {
      orgId: ctx.orgId,
      userId,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, name: true },
  })
  if (taken) {
    throw conflict(`That login user is already linked to ${taken.name}.`)
  }
  return userId
}

async function assertManager(ctx: OrgContext, managerId: string | null, selfId?: string) {
  if (!managerId) return null
  if (selfId && managerId === selfId) {
    throw validation('An employee cannot manage themselves.', {
      managerId: ['Choose a different manager'],
    })
  }
  const manager = await db.employee.findFirst({
    where: { id: managerId, orgId: ctx.orgId },
    select: { id: true, managerId: true },
  })
  if (!manager) {
    throw validation('That manager is not in this company.', {
      managerId: ['Choose an employee'],
    })
  }
  if (selfId) {
    // Block cycles: walk up from proposed manager; self must not appear.
    let cursor: string | null = manager.managerId
    const seen = new Set<string>([managerId])
    while (cursor) {
      if (cursor === selfId) {
        throw validation('That manager would create a reporting loop.', {
          managerId: ['Choose someone higher in the tree'],
        })
      }
      if (seen.has(cursor)) break
      seen.add(cursor)
      const up: { managerId: string | null } | null = await db.employee.findFirst({
        where: { id: cursor, orgId: ctx.orgId },
        select: { managerId: true },
      })
      cursor = up?.managerId ?? null
    }
  }
  return managerId
}

async function requireEmployee(ctx: OrgContext, id: string) {
  const row = await db.employee.findFirst({
    where: { id, orgId: ctx.orgId },
    select: SELECT,
  })
  if (!row) throw notFound('Employee')
  return mapRow(row)
}

function writeData(
  input: EmployeeInput,
  userId: string | null,
  managerId: string | null,
): Prisma.EmployeeUncheckedCreateInput {
  return {
    orgId: '',
    name: input.name,
    jobTitle: input.jobTitle ?? null,
    department: input.department ?? null,
    photoUrl: input.photoUrl ?? null,
    workEmail: input.workEmail ?? null,
    workPhone: input.workPhone ?? null,
    mobile: input.mobile ?? null,
    workStreet: input.workStreet ?? null,
    workCity: input.workCity ?? null,
    workCountry: input.workCountry ?? null,
    privateStreet: input.privateStreet ?? null,
    privateCity: input.privateCity ?? null,
    privateCountry: input.privateCountry ?? null,
    emergencyContact: input.emergencyContact ?? null,
    emergencyPhone: input.emergencyPhone ?? null,
    skills: input.skills ?? null,
    notes: input.notes ?? null,
    employmentType: input.employmentType ?? 'EMPLOYEE',
    hiredAt: input.hiredAt ? toDate(input.hiredAt) : null,
    leftAt: input.leftAt ? toDate(input.leftAt) : null,
    managerId,
    userId,
    wageType: input.wageType ?? 'MONTHLY',
    wageAmount: money(input.wageAmount ?? '0'),
    expenseAccountId: input.expenseAccountId ?? null,
    payableAccountId: input.payableAccountId ?? null,
    active: input.active ?? true,
  }
}

export async function list(
  ctx: OrgContext,
  opts: { q?: string; active?: boolean | 'all' } = {},
): Promise<EmployeeRow[]> {
  const activeFilter =
    opts.active === 'all' ? undefined : opts.active === false ? false : true
  const q = opts.q?.trim()
  const rows = await db.employee.findMany({
    where: {
      orgId: ctx.orgId,
      ...(activeFilter === undefined ? {} : { active: activeFilter }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { jobTitle: { contains: q, mode: 'insensitive' } },
              { department: { contains: q, mode: 'insensitive' } },
              { workEmail: { contains: q, mode: 'insensitive' } },
              { workPhone: { contains: q, mode: 'insensitive' } },
              { mobile: { contains: q, mode: 'insensitive' } },
              { skills: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: SELECT,
    orderBy: [{ name: 'asc' }],
  })
  return rows.map(mapRow)
}

export async function get(ctx: OrgContext, id: string) {
  return requireEmployee(ctx, id)
}

export async function listLinkableUsers(ctx: OrgContext, excludeEmployeeId?: string): Promise<ColleagueOption[]> {
  const linked = await db.employee.findMany({
    where: {
      orgId: ctx.orgId,
      userId: { not: null },
      ...(excludeEmployeeId ? { NOT: { id: excludeEmployeeId } } : {}),
    },
    select: { userId: true },
  })
  const taken = new Set(linked.map((row) => row.userId).filter(Boolean) as string[])

  const members = await db.membership.findMany({
    where: { orgId: ctx.orgId, status: 'ACTIVE' },
    select: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: 'asc' } },
  })

  return members
    .map((row) => row.user)
    .filter((user) => !taken.has(user.id))
    .map((user) => ({ id: user.id, name: user.name, email: user.email }))
}

export async function listManagers(ctx: OrgContext, excludeEmployeeId?: string): Promise<ManagerOption[]> {
  const rows = await db.employee.findMany({
    where: {
      orgId: ctx.orgId,
      active: true,
      ...(excludeEmployeeId ? { NOT: { id: excludeEmployeeId } } : {}),
    },
    select: { id: true, name: true, jobTitle: true },
    orderBy: { name: 'asc' },
  })
  return rows
}

export async function create(ctx: OrgContext, input: EmployeeInput) {
  const userId = await assertUserAvailable(ctx, input.userId ?? null)
  const managerId = await assertManager(ctx, input.managerId ?? null)
  const data = writeData(input, userId, managerId)
  data.orgId = ctx.orgId
  const row = await db.employee.create({ data, select: SELECT })
  return mapRow(row)
}

export async function update(ctx: OrgContext, id: string, input: EmployeeUpdateInput) {
  const before = await requireEmployee(ctx, id)
  const userId = await assertUserAvailable(ctx, input.userId ?? null, id)
  const managerId = await assertManager(ctx, input.managerId ?? null, id)
  const { id: _id, wageRaiseNote, ...fields } = input
  const { orgId: _orgId, ...rest } = writeData(fields, userId, managerId)

  const nextWageType = rest.wageType ?? before.wageType
  const nextWageAmount =
    typeof rest.wageAmount === 'object' && rest.wageAmount && 'toFixed' in rest.wageAmount
      ? rest.wageAmount.toFixed(4)
      : money(String(rest.wageAmount ?? before.wageAmount)).toFixed(4)
  const prevWageAmount = money(before.wageAmount).toFixed(4)
  const wageChanged =
    nextWageType !== before.wageType || nextWageAmount !== prevWageAmount

  const meta = await requestMeta()
  const row = await db.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id },
      data: rest,
      select: SELECT,
    })
    if (wageChanged) {
      await writeAudit(
        tx,
        ctx,
        {
          entity: 'Employee',
          entityId: id,
          action: 'UPDATE',
          before: {
            wageType: before.wageType,
            wageAmount: prevWageAmount,
          },
          after: {
            wageChange: true,
            wageType: nextWageType,
            wageAmount: nextWageAmount,
            note: wageRaiseNote ?? null,
          },
        },
        meta,
      )
    }
    return updated
  })
  return mapRow(row)
}

export type WageChangeEvent = {
  at: Date
  actorName: string
  fromType: string
  toType: string
  fromAmount: string
  toAmount: string
  note: string | null
}

/** Wage raises / cuts recorded when the employee card wage fields change. */
export async function listWageChanges(ctx: OrgContext, employeeId: string): Promise<WageChangeEvent[]> {
  await requireEmployee(ctx, employeeId)
  const rows = await db.auditLog.findMany({
    where: {
      orgId: ctx.orgId,
      entity: 'Employee',
      entityId: employeeId,
      action: 'UPDATE',
    },
    select: {
      at: true,
      before: true,
      after: true,
      actor: { select: { name: true } },
    },
    orderBy: { at: 'desc' },
    take: 50,
  })

  const events: WageChangeEvent[] = []
  for (const row of rows) {
    const after = row.after as Record<string, unknown> | null
    if (!after || after.wageChange !== true) continue
    const before = row.before as Record<string, unknown> | null
    events.push({
      at: row.at,
      actorName: row.actor?.name ?? 'System',
      fromType: String(before?.wageType ?? ''),
      toType: String(after.wageType ?? ''),
      fromAmount: String(before?.wageAmount ?? ''),
      toAmount: String(after.wageAmount ?? ''),
      note: typeof after.note === 'string' && after.note.trim() ? after.note.trim() : null,
    })
  }
  return events
}

export async function setActive(ctx: OrgContext, id: string, active: boolean) {
  await requireEmployee(ctx, id)
  const row = await db.employee.update({
    where: { id },
    data: {
      active,
      ...(active ? {} : { leftAt: new Date() }),
    },
    select: SELECT,
  })
  return mapRow(row)
}

export async function remove(ctx: OrgContext, id: string) {
  await requireEmployee(ctx, id)
  await db.employee.delete({ where: { id } })
}

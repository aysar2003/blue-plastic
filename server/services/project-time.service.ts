import 'server-only'

import { Decimal } from '@/lib/money'
import { toCalendarDate, toDate, today, type CalendarDate } from '@/lib/date'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'

export type TimeEntryInput = {
  projectId: string
  taskId?: string | null
  workDate: CalendarDate
  hours: string
  description?: string | null
  billable?: boolean
  billableRate?: string | null
}

export async function listForProject(ctx: OrgContext, projectId: string) {
  assertPermission(ctx, 'project:read')
  const project = await db.project.findFirst({
    where: { id: projectId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!project) throw notFound('Project')

  const rows = await db.projectTimeEntry.findMany({
    where: { orgId: ctx.orgId, projectId },
    orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      workDate: true,
      hours: true,
      description: true,
      billable: true,
      billableRate: true,
      invoicedAt: true,
      taskId: true,
      task: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
  })

  return rows.map((row) => ({
    ...row,
    workDate: toCalendarDate(row.workDate),
    hours: row.hours.toString(),
    billableRate: row.billableRate?.toString() ?? null,
  }))
}

/** Unbilled billable hours for a customer’s open projects — pull onto an invoice. */
export async function listBillableForCustomer(ctx: OrgContext, customerId: string) {
  assertPermission(ctx, 'invoice:create')
  const rows = await db.projectTimeEntry.findMany({
    where: {
      orgId: ctx.orgId,
      billable: true,
      invoicedAt: null,
      project: { customerId, orgId: ctx.orgId },
    },
    orderBy: { workDate: 'asc' },
    select: {
      id: true,
      hours: true,
      billableRate: true,
      description: true,
      workDate: true,
      project: { select: { id: true, number: true, name: true } },
      user: { select: { name: true } },
    },
  })
  return rows.map((row) => {
    const hours = new Decimal(row.hours.toString())
    const rate = new Decimal(row.billableRate?.toString() ?? 0)
    return {
      id: row.id,
      projectId: row.project.id,
      projectLabel: `${row.project.number} · ${row.project.name}`,
      workDate: toCalendarDate(row.workDate),
      hours: hours.toString(),
      billableRate: rate.toString(),
      amount: hours.times(rate).toFixed(4),
      description:
        row.description?.trim() ||
        `Time · ${row.user.name} · ${toCalendarDate(row.workDate)}`,
    }
  })
}

export async function create(ctx: OrgContext, input: TimeEntryInput) {
  assertPermission(ctx, 'project:update')
  const hours = new Decimal(input.hours)
  if (hours.lessThanOrEqualTo(0)) throw validation('Hours must be greater than zero.')

  const project = await db.project.findFirst({
    where: { id: input.projectId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!project) throw notFound('Project')

  if (input.taskId) {
    const task = await db.projectTask.findFirst({
      where: { id: input.taskId, orgId: ctx.orgId, projectId: project.id },
      select: { id: true },
    })
    if (!task) throw notFound('Task')
  }

  const rate =
    input.billable === false
      ? null
      : input.billableRate
        ? new Decimal(input.billableRate)
        : null
  if (rate && rate.isNegative()) throw validation('Billable rate cannot be negative.')

  const row = await db.projectTimeEntry.create({
    data: {
      orgId: ctx.orgId,
      projectId: project.id,
      taskId: input.taskId ?? null,
      userId: ctx.userId,
      workDate: toDate(input.workDate),
      hours: hours.toFixed(4),
      description: input.description ?? null,
      billable: input.billable !== false,
      billableRate: rate?.toFixed(4) ?? null,
    },
    select: { id: true },
  })
  return row
}

export async function remove(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'project:update')
  const row = await db.projectTimeEntry.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, invoicedAt: true },
  })
  if (!row) throw notFound('Time entry')
  if (row.invoicedAt) {
    throw precondition('This time entry is already on an invoice and cannot be deleted.')
  }
  await db.projectTimeEntry.delete({ where: { id: row.id } })
  return { id: row.id }
}

/** Mark time entries as invoiced after they are added as invoice lines. */
export async function markInvoiced(ctx: OrgContext, ids: string[]) {
  if (ids.length === 0) return
  assertPermission(ctx, 'invoice:create')
  await db.projectTimeEntry.updateMany({
    where: {
      orgId: ctx.orgId,
      id: { in: ids },
      invoicedAt: null,
      billable: true,
    },
    data: { invoicedAt: new Date() },
  })
}

export function defaultWorkDate(ctx: OrgContext): CalendarDate {
  return today(ctx.organization.timeZone)
}

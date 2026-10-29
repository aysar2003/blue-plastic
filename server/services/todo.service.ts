import 'server-only'

import type { Prisma } from '@prisma/client'

import { toCalendarDate, toDate } from '@/lib/date'
import { digitsOnlyPhone, type TodoPriority } from '@/lib/todo-notify'
import type { TodoCompletion, TodoStage } from '@/lib/todo-workflow'
import type { TodoCompleteInput, TodoInput } from '@/lib/validation/todo'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'
import * as todoNotify from '@/server/services/todo-notify.service'

const SELECT = {
  id: true,
  title: true,
  notes: true,
  dueDate: true,
  priority: true,
  stage: true,
  doneAt: true,
  completionKind: true,
  completionNote: true,
  completedById: true,
  sequence: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  assigneeId: true,
  owner: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true, phone: true } },
  completedBy: { select: { id: true, name: true } },
} satisfies Prisma.WorkspaceTodoSelect

export type TodoRow = {
  id: string
  title: string
  notes: string | null
  dueDate: string | null
  priority: TodoPriority
  stage: TodoStage
  doneAt: Date | null
  completionKind: TodoCompletion | null
  completionNote: string | null
  completedByName: string | null
  sequence: number
  createdAt: Date
  updatedAt: Date
  userId: string
  assigneeId: string | null
  ownerName: string
  assigneeName: string | null
}

export type TodoWriteResult = {
  row: TodoRow
  notify: todoNotify.TodoNotifyResult[]
}

function asPriority(value: number): TodoPriority {
  if (value === 1 || value === 2) return value
  return 0
}

function mapRow(row: {
  id: string
  title: string
  notes: string | null
  dueDate: Date | null
  priority: number
  stage: TodoStage
  doneAt: Date | null
  completionKind: TodoCompletion | null
  completionNote: string | null
  completedById: string | null
  sequence: number
  createdAt: Date
  updatedAt: Date
  userId: string
  assigneeId: string | null
  owner: { id: string; name: string }
  assignee: { id: string; name: string; email: string; phone: string | null } | null
  completedBy: { id: string; name: string } | null
}): TodoRow {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.dueDate ? toCalendarDate(row.dueDate) : null,
    priority: asPriority(row.priority),
    stage: row.stage,
    doneAt: row.doneAt,
    completionKind: row.completionKind,
    completionNote: row.completionNote,
    completedByName: row.completedBy?.name ?? null,
    sequence: row.sequence,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    userId: row.userId,
    assigneeId: row.assigneeId,
    ownerName: row.owner.name,
    assigneeName: row.assignee?.name ?? null,
  }
}

async function requireAssignee(ctx: OrgContext, assigneeId: string | null | undefined) {
  if (!assigneeId) return null
  const member = await db.membership.findFirst({
    where: { orgId: ctx.orgId, userId: assigneeId, status: 'ACTIVE' },
    select: { userId: true },
  })
  if (!member) {
    throw validation('That person is not on this company.', {
      assigneeId: ['Choose someone on this company'],
    })
  }
  return member.userId
}

async function requireTodo(ctx: OrgContext, id: string) {
  const row = await db.workspaceTodo.findFirst({
    where: { id, orgId: ctx.orgId },
    select: SELECT,
  })
  if (!row) throw notFound('To-do')
  return row
}

async function maybeNotifyAssignment(
  ctx: OrgContext,
  input: TodoInput,
  row: {
    title: string
    notes: string | null
    dueDate: Date | null
    priority: number
    assigneeId: string | null
    assignee: { id: string; name: string; email: string; phone: string | null } | null
  },
  previousAssigneeId: string | null | undefined,
): Promise<todoNotify.TodoNotifyResult[]> {
  const assigneeId = row.assigneeId
  if (!assigneeId || assigneeId === ctx.userId || !row.assignee) return []
  if (previousAssigneeId === assigneeId) return []

  const channels: todoNotify.DeliverTodoAssignmentInput['channels'] = []
  if (input.notifyEmail) channels.push('email')
  if (input.notifyWhatsapp) channels.push('whatsapp')
  if (channels.length === 0) return []

  const overridePhone = digitsOnlyPhone(input.whatsappPhone ?? null)
  let phone = overridePhone ?? row.assignee.phone
  if (overridePhone && overridePhone !== digitsOnlyPhone(row.assignee.phone)) {
    await db.user.update({
      where: { id: assigneeId },
      data: { phone: overridePhone },
    })
    phone = overridePhone
  }

  return todoNotify.deliverTodoAssignment(ctx, {
    todo: {
      title: row.title,
      notes: row.notes,
      dueDate: row.dueDate ? toCalendarDate(row.dueDate) : null,
      priority: asPriority(row.priority),
    },
    assignee: {
      id: row.assignee.id,
      name: row.assignee.name,
      email: row.assignee.email,
      phone,
    },
    channels,
  })
}

/** Items visible to this user, grouped by the four workflow stages. */
export async function listForUser(
  ctx: OrgContext,
): Promise<Record<TodoStage, TodoRow[]>> {
  const rows = await db.workspaceTodo.findMany({
    where: {
      orgId: ctx.orgId,
      OR: [{ userId: ctx.userId }, { assigneeId: ctx.userId }],
    },
    select: SELECT,
    orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
    take: 500,
  })
  const mapped = rows.map(mapRow)
  const done = mapped.filter((row) => row.stage === 'DONE').slice(0, 100)
  return {
    OPEN: mapped.filter((row) => row.stage === 'OPEN'),
    IN_PROGRESS: mapped.filter((row) => row.stage === 'IN_PROGRESS'),
    WAITING: mapped.filter((row) => row.stage === 'WAITING'),
    DONE: done,
  }
}

export async function listColleagues(ctx: OrgContext) {
  const rows = await db.membership.findMany({
    where: { orgId: ctx.orgId, status: 'ACTIVE' },
    select: { user: { select: { id: true, name: true, phone: true } } },
    orderBy: { user: { name: 'asc' } },
    take: 200,
  })
  return rows.map((row) => ({
    id: row.user.id,
    name: row.user.name,
    phone: row.user.phone,
  }))
}

export async function create(ctx: OrgContext, input: TodoInput): Promise<TodoWriteResult> {
  const assigneeId = await requireAssignee(ctx, input.assigneeId)
  const max = await db.workspaceTodo.aggregate({
    where: { orgId: ctx.orgId, userId: ctx.userId, stage: { not: 'DONE' } },
    _max: { sequence: true },
  })

  const row = await db.workspaceTodo.create({
    data: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      assigneeId,
      title: input.title,
      notes: input.notes ?? null,
      dueDate: input.dueDate ? toDate(input.dueDate) : null,
      priority: asPriority(input.priority ?? 0),
      stage: 'OPEN',
      sequence: (max._max.sequence ?? 0) + 1,
    },
    select: SELECT,
  })

  const notify = await maybeNotifyAssignment(ctx, input, row, null)
  return { row: mapRow(row), notify }
}

export async function update(
  ctx: OrgContext,
  id: string,
  input: TodoInput,
): Promise<TodoWriteResult> {
  const existing = await requireTodo(ctx, id)
  const assigneeId = await requireAssignee(ctx, input.assigneeId)
  const row = await db.workspaceTodo.update({
    where: { id },
    data: {
      title: input.title,
      notes: input.notes ?? null,
      dueDate: input.dueDate ? toDate(input.dueDate) : null,
      priority: asPriority(input.priority ?? 0),
      assigneeId,
    },
    select: SELECT,
  })

  const notify = await maybeNotifyAssignment(ctx, input, row, existing.assigneeId)
  return { row: mapRow(row), notify }
}

/** Move between Open / In progress / Waiting (not Done — use complete). */
export async function setStage(ctx: OrgContext, id: string, stage: TodoStage) {
  if (stage === 'DONE') {
    throw validation('Use complete to finish a to-do with a note and result.')
  }
  await requireTodo(ctx, id)
  const row = await db.workspaceTodo.update({
    where: { id },
    data: {
      stage,
      doneAt: null,
      completionKind: null,
      completionNote: null,
      completedById: null,
    },
    select: SELECT,
  })
  return mapRow(row)
}

/** Close as Done with one of four results + optional note / report. */
export async function complete(ctx: OrgContext, input: TodoCompleteInput) {
  await requireTodo(ctx, input.id)
  const row = await db.workspaceTodo.update({
    where: { id: input.id },
    data: {
      stage: 'DONE',
      doneAt: new Date(),
      completionKind: input.completionKind,
      completionNote: input.completionNote?.trim() || null,
      completedById: ctx.userId,
    },
    select: SELECT,
  })
  return mapRow(row)
}

/** Reopen a done item back to Open. */
export async function reopen(ctx: OrgContext, id: string) {
  await requireTodo(ctx, id)
  const row = await db.workspaceTodo.update({
    where: { id },
    data: {
      stage: 'OPEN',
      doneAt: null,
      completionKind: null,
      completionNote: null,
      completedById: null,
    },
    select: SELECT,
  })
  return mapRow(row)
}

export async function remove(ctx: OrgContext, id: string) {
  await requireTodo(ctx, id)
  await db.workspaceTodo.delete({ where: { id } })
}

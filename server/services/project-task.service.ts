import 'server-only'

import type { Prisma } from '@prisma/client'

import { toCalendarDate, toDate } from '@/lib/date'
import type { ProjectTaskInput } from '@/lib/validation/project-task'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'

async function requireAssignee(ctx: OrgContext, assigneeId: string | null | undefined) {
  if (!assigneeId) return null
  const member = await db.membership.findFirst({
    where: { orgId: ctx.orgId, userId: assigneeId },
    select: { userId: true },
  })
  if (!member) {
    throw validation('That person is not on this company.', {
      assigneeId: ['Choose someone on this company'],
    })
  }
  return member.userId
}

const SELECT = {
  id: true,
  projectId: true,
  name: true,
  description: true,
  stage: true,
  sequence: true,
  deadline: true,
  startDate: true,
  parentTaskId: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true } },
  blockersAsSuccessor: {
    select: {
      id: true,
      predecessorId: true,
      predecessor: { select: { id: true, name: true, stage: true } },
    },
  },
} satisfies Prisma.ProjectTaskSelect

function mapTask<T extends { deadline: Date | null; startDate: Date | null }>(row: T) {
  return {
    ...row,
    deadline: row.deadline ? toCalendarDate(row.deadline) : null,
    startDate: row.startDate ? toCalendarDate(row.startDate) : null,
  }
}

async function requireProject(ctx: OrgContext, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, orgId: ctx.orgId },
    select: { id: true, name: true, number: true },
  })
  if (!project) throw notFound('Project')
  return project
}

async function resolveParentTask(
  ctx: OrgContext,
  projectId: string,
  parentTaskId: string | null | undefined,
  selfId?: string,
) {
  if (!parentTaskId) return null
  if (selfId && parentTaskId === selfId) {
    throw validation('A task cannot be its own parent.', {
      parentTaskId: ['Choose a different parent'],
    })
  }
  const parent = await db.projectTask.findFirst({
    where: { id: parentTaskId, orgId: ctx.orgId, projectId },
    select: { id: true },
  })
  if (!parent) {
    throw validation('Parent task must be on the same project.', {
      parentTaskId: ['Choose a task on this project'],
    })
  }
  return parent.id
}

export async function listForProject(ctx: OrgContext, projectId: string) {
  await requireProject(ctx, projectId)
  const rows = await db.projectTask.findMany({
    where: { orgId: ctx.orgId, projectId },
    select: SELECT,
    orderBy: [{ stage: 'asc' }, { sequence: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map(mapTask)
}

/** Open tasks assigned to the signed-in user across all projects. */
export async function listMine(ctx: OrgContext) {
  const rows = await db.projectTask.findMany({
    where: {
      orgId: ctx.orgId,
      assigneeId: ctx.userId,
      stage: { notIn: ['DONE', 'CANCELLED'] },
    },
    select: {
      ...SELECT,
      project: { select: { id: true, number: true, name: true } },
    },
    orderBy: [{ deadline: 'asc' }, { updatedAt: 'desc' }],
    take: 200,
  })
  return rows.map(mapTask)
}

export async function create(ctx: OrgContext, input: ProjectTaskInput) {
  const project = await requireProject(ctx, input.projectId)
  const assigneeId = await requireAssignee(ctx, input.assigneeId)
  const parentTaskId = await resolveParentTask(ctx, project.id, input.parentTaskId)
  const meta = await requestMeta()

  const max = await db.projectTask.aggregate({
    where: { orgId: ctx.orgId, projectId: project.id, stage: input.stage },
    _max: { sequence: true },
  })

  return db.$transaction(async (tx) => {
    const row = await tx.projectTask.create({
      data: {
        orgId: ctx.orgId,
        projectId: project.id,
        name: input.name,
        description: input.description ?? null,
        stage: input.stage,
        sequence: (max._max.sequence ?? 0) + 1,
        assigneeId,
        deadline: input.deadline ? toDate(input.deadline) : null,
        startDate: input.startDate ? toDate(input.startDate) : null,
        parentTaskId,
        createdById: ctx.userId,
      },
      select: SELECT,
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ProjectTask',
        entityId: row.id,
        action: 'CREATE',
        after: { name: row.name, stage: row.stage, project: project.number },
      },
      meta,
    )
    return mapTask(row)
  })
}

export async function update(
  ctx: OrgContext,
  id: string,
  input: Omit<ProjectTaskInput, 'projectId'>,
) {
  const existing = await db.projectTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, projectId: true, name: true, stage: true },
  })
  if (!existing) throw notFound('Task')

  const assigneeId = await requireAssignee(ctx, input.assigneeId)
  const parentTaskId = await resolveParentTask(
    ctx,
    existing.projectId,
    input.parentTaskId,
    existing.id,
  )
  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const row = await tx.projectTask.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description ?? null,
        stage: input.stage,
        assigneeId,
        deadline: input.deadline ? toDate(input.deadline) : null,
        startDate: input.startDate ? toDate(input.startDate) : null,
        parentTaskId,
      },
      select: SELECT,
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ProjectTask',
        entityId: row.id,
        action: 'UPDATE',
        before: { name: existing.name, stage: existing.stage },
        after: { name: row.name, stage: row.stage },
      },
      meta,
    )
    return mapTask(row)
  })
}

export async function move(ctx: OrgContext, id: string, stage: string) {
  const existing = await db.projectTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      projectId: true,
      stage: true,
      name: true,
      blockersAsSuccessor: {
        select: {
          predecessor: { select: { id: true, name: true, stage: true } },
        },
      },
    },
  })
  if (!existing) throw notFound('Task')
  if (existing.stage === stage) {
    return { id: existing.id, projectId: existing.projectId, stage }
  }

  if (stage === 'DONE') {
    const openBlockers = existing.blockersAsSuccessor.filter(
      (dep) => dep.predecessor.stage !== 'DONE' && dep.predecessor.stage !== 'CANCELLED',
    )
    if (openBlockers.length > 0) {
      const names = openBlockers.map((d) => d.predecessor.name).join(', ')
      throw precondition(`Finish blockers first: ${names}`)
    }
  }

  const max = await db.projectTask.aggregate({
    where: { orgId: ctx.orgId, projectId: existing.projectId, stage },
    _max: { sequence: true },
  })

  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const row = await tx.projectTask.update({
      where: { id: existing.id },
      data: { stage, sequence: (max._max.sequence ?? 0) + 1 },
      select: { id: true, projectId: true, stage: true, name: true },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ProjectTask',
        entityId: row.id,
        action: 'UPDATE',
        before: { stage: existing.stage },
        after: { stage: row.stage, name: row.name },
      },
      meta,
    )
    return row
  })
}

export async function addDependency(
  ctx: OrgContext,
  input: { predecessorId: string; successorId: string },
) {
  if (input.predecessorId === input.successorId) {
    throw validation('A task cannot block itself.')
  }
  const [pred, succ] = await Promise.all([
    db.projectTask.findFirst({
      where: { id: input.predecessorId, orgId: ctx.orgId },
      select: { id: true, projectId: true, name: true },
    }),
    db.projectTask.findFirst({
      where: { id: input.successorId, orgId: ctx.orgId },
      select: { id: true, projectId: true, name: true },
    }),
  ])
  if (!pred || !succ) throw notFound('Task')
  if (pred.projectId !== succ.projectId) {
    throw validation('Both tasks must be on the same project.')
  }

  // Cheap cycle guard: successor already blocks predecessor (direct or via list).
  const reverse = await db.projectTaskDependency.findFirst({
    where: {
      orgId: ctx.orgId,
      predecessorId: input.successorId,
      successorId: input.predecessorId,
    },
    select: { id: true },
  })
  if (reverse) throw validation('That would create a circular dependency.')

  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const row = await tx.projectTaskDependency.create({
      data: {
        orgId: ctx.orgId,
        predecessorId: pred.id,
        successorId: succ.id,
      },
      select: { id: true, predecessorId: true, successorId: true },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ProjectTaskDependency',
        entityId: row.id,
        action: 'CREATE',
        after: { predecessor: pred.name, successor: succ.name },
      },
      meta,
    )
    return { ...row, projectId: pred.projectId }
  })
}

export async function removeDependency(ctx: OrgContext, id: string) {
  const existing = await db.projectTaskDependency.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      predecessorId: true,
      successorId: true,
      successor: { select: { projectId: true } },
    },
  })
  if (!existing) throw notFound('Dependency')
  const meta = await requestMeta()
  await db.$transaction(async (tx) => {
    await tx.projectTaskDependency.delete({ where: { id: existing.id } })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ProjectTaskDependency',
        entityId: existing.id,
        action: 'DELETE',
        before: {
          predecessorId: existing.predecessorId,
          successorId: existing.successorId,
        },
      },
      meta,
    )
  })
  return {
    id: existing.id,
    predecessorId: existing.predecessorId,
    successorId: existing.successorId,
    projectId: existing.successor.projectId,
  }
}

export async function remove(ctx: OrgContext, id: string) {
  const existing = await db.projectTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, name: true, projectId: true },
  })
  if (!existing) throw notFound('Task')
  if (!existing.name.trim()) throw validation('Task name is required.')

  const meta = await requestMeta()
  await db.$transaction(async (tx) => {
    await tx.projectTask.delete({ where: { id: existing.id } })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ProjectTask',
        entityId: existing.id,
        action: 'DELETE',
        before: { name: existing.name },
      },
      meta,
    )
  })
  return { id: existing.id, projectId: existing.projectId }
}

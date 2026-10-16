import 'server-only'

import type { Prisma, ProjectTaskStage } from '@prisma/client'

import { toCalendarDate, toDate } from '@/lib/date'
import type { ProjectTaskInput } from '@/lib/validation/project-task'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

const SELECT = {
  id: true,
  projectId: true,
  name: true,
  description: true,
  stage: true,
  sequence: true,
  deadline: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.ProjectTaskSelect

async function requireProject(ctx: OrgContext, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, orgId: ctx.orgId },
    select: { id: true, name: true, number: true },
  })
  if (!project) throw notFound('Project')
  return project
}

export async function listForProject(ctx: OrgContext, projectId: string) {
  await requireProject(ctx, projectId)
  const rows = await db.projectTask.findMany({
    where: { orgId: ctx.orgId, projectId },
    select: SELECT,
    orderBy: [{ stage: 'asc' }, { sequence: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map((row) => ({
    ...row,
    deadline: row.deadline ? toCalendarDate(row.deadline) : null,
  }))
}

export async function create(ctx: OrgContext, input: ProjectTaskInput) {
  const project = await requireProject(ctx, input.projectId)
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
        assigneeId: input.assigneeId ?? null,
        deadline: input.deadline ? toDate(input.deadline) : null,
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
    return {
      ...row,
      deadline: row.deadline ? toCalendarDate(row.deadline) : null,
    }
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

  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const row = await tx.projectTask.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description ?? null,
        stage: input.stage,
        assigneeId: input.assigneeId ?? null,
        deadline: input.deadline ? toDate(input.deadline) : null,
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
    return {
      ...row,
      deadline: row.deadline ? toCalendarDate(row.deadline) : null,
    }
  })
}

export async function move(ctx: OrgContext, id: string, stage: ProjectTaskStage) {
  const existing = await db.projectTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, projectId: true, stage: true, name: true },
  })
  if (!existing) throw notFound('Task')
  if (existing.stage === stage) {
    return { id: existing.id, stage }
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
      select: { id: true, stage: true, name: true },
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

export async function remove(ctx: OrgContext, id: string) {
  const existing = await db.projectTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, name: true },
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
  return { id: existing.id }
}

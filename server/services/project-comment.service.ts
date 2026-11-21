import 'server-only'

import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'

export async function listForProject(ctx: OrgContext, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!project) throw notFound('Project')

  return db.projectComment.findMany({
    where: { orgId: ctx.orgId, projectId: project.id },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function create(ctx: OrgContext, input: { projectId: string; body: string }) {
  const body = input.body.trim()
  if (!body) throw validation('Write a note first.', { body: ['Required'] })
  if (body.length > 4000) throw validation('Note is too long.', { body: ['Max 4000 characters'] })

  const project = await db.project.findFirst({
    where: { id: input.projectId, orgId: ctx.orgId },
    select: { id: true, number: true },
  })
  if (!project) throw notFound('Project')

  const meta = await requestMeta()
  return db.$transaction(async (tx) => {
    const row = await tx.projectComment.create({
      data: {
        orgId: ctx.orgId,
        projectId: project.id,
        authorId: ctx.userId,
        body,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'ProjectComment',
        entityId: row.id,
        action: 'CREATE',
        after: { project: project.number, body: body.slice(0, 120) },
      },
      meta,
    )
    return row
  })
}

import 'server-only'

import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound } from '@/server/errors'
import * as hrFiles from '@/server/files/employee-hr-files'

export async function list(ctx: OrgContext) {
  const rows = await db.hrPolicy.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  })
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    published: row.published,
    sortOrder: row.sortOrder,
    hasFile: Boolean(row.storageKey),
    originalName: row.originalName,
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function get(ctx: OrgContext, id: string) {
  const row = await db.hrPolicy.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!row) throw notFound('Policy')
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    published: row.published,
    sortOrder: row.sortOrder,
    hasFile: Boolean(row.storageKey),
    originalName: row.originalName,
    contentType: row.contentType,
    byteSize: row.byteSize,
  }
}

export async function create(
  ctx: OrgContext,
  input: { title: string; body?: string; published?: boolean; sortOrder?: number },
) {
  const row = await db.hrPolicy.create({
    data: {
      orgId: ctx.orgId,
      title: input.title,
      body: input.body ?? '',
      published: input.published ?? false,
      sortOrder: input.sortOrder ?? 0,
      createdById: ctx.userId,
    },
  })
  return { id: row.id }
}

export async function update(
  ctx: OrgContext,
  id: string,
  input: { title: string; body?: string; published?: boolean; sortOrder?: number },
) {
  const existing = await db.hrPolicy.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!existing) throw notFound('Policy')
  const row = await db.hrPolicy.update({
    where: { id },
    data: {
      title: input.title,
      body: input.body ?? '',
      published: input.published ?? false,
      sortOrder: input.sortOrder ?? 0,
    },
  })
  return { id: row.id }
}

export async function remove(ctx: OrgContext, id: string) {
  const existing = await db.hrPolicy.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, storageKey: true },
  })
  if (!existing) throw notFound('Policy')
  if (existing.storageKey) {
    await hrFiles.clearPolicyFile(ctx, id).catch(() => undefined)
  }
  await db.hrPolicy.delete({ where: { id } })
}

export async function uploadFile(ctx: OrgContext, id: string, file: File) {
  await hrFiles.attachPolicyFile(ctx, id, file)
}

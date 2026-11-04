import 'server-only'

import type { TrackingCategoryInput } from '@/lib/validation/master-data'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { conflict, notFound, validation } from '@/server/errors'

export async function list(ctx: OrgContext, options: { includeInactive?: boolean } = {}) {
  return db.trackingCategory.findMany({
    where: { orgId: ctx.orgId, ...(options.includeInactive ? {} : { isActive: true }) },
    select: { id: true, name: true, isActive: true },
    orderBy: { name: 'asc' },
  })
}

/** Confirm a class belongs to this organisation. Blank stays blank. */
export async function resolveId(
  tx: Tx,
  ctx: OrgContext,
  trackingCategoryId: string | null | undefined,
): Promise<string | null> {
  if (!trackingCategoryId) return null
  const row = await tx.trackingCategory.findFirst({
    where: { id: trackingCategoryId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!row) {
    throw validation('That class was not found.', {
      trackingCategoryId: ['Choose a class on this company'],
    })
  }
  return row.id
}

export async function create(ctx: OrgContext, input: TrackingCategoryInput) {
  const meta = await requestMeta()
  const name = input.name.trim()
  const existing = await db.trackingCategory.findUnique({
    where: { orgId_name: { orgId: ctx.orgId, name } },
    select: { id: true },
  })
  if (existing) throw conflict(`A class called "${name}" already exists.`)

  return db.$transaction(async (tx) => {
    const row = await tx.trackingCategory.create({
      data: { orgId: ctx.orgId, name },
      select: { id: true, name: true },
    })
    await writeAudit(tx, ctx, { entity: 'TrackingCategory', entityId: row.id, action: 'CREATE', after: { name } }, meta)
    return row
  })
}

export async function update(ctx: OrgContext, input: TrackingCategoryInput & { id: string }) {
  const meta = await requestMeta()
  const name = input.name.trim()
  const current = await db.trackingCategory.findFirst({
    where: { id: input.id, orgId: ctx.orgId },
    select: { id: true, name: true },
  })
  if (!current) throw notFound('Class')

  const clash = await db.trackingCategory.findUnique({
    where: { orgId_name: { orgId: ctx.orgId, name } },
    select: { id: true },
  })
  if (clash && clash.id !== current.id) throw conflict(`A class called "${name}" already exists.`)

  return db.$transaction(async (tx) => {
    const row = await tx.trackingCategory.update({
      where: { id: current.id },
      data: { name },
      select: { id: true, name: true },
    })
    await writeAudit(
      tx,
      ctx,
      { entity: 'TrackingCategory', entityId: row.id, action: 'UPDATE', before: { name: current.name }, after: { name } },
      meta,
    )
    return row
  })
}

export async function setActive(ctx: OrgContext, id: string, isActive: boolean) {
  const meta = await requestMeta()
  const current = await db.trackingCategory.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, name: true },
  })
  if (!current) throw notFound('Class')

  return db.$transaction(async (tx) => {
    const row = await tx.trackingCategory.update({
      where: { id: current.id },
      data: { isActive },
      select: { id: true, name: true, isActive: true },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'TrackingCategory',
        entityId: row.id,
        action: isActive ? 'RESTORE' : 'ARCHIVE',
        after: { isActive },
      },
      meta,
    )
    return row
  })
}

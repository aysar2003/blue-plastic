import 'server-only'
import type { Prisma } from '@prisma/client'

import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

const TRAIL_ACTIONS = ['CREATE', 'UPDATE', 'POST', 'DELETE', 'ARCHIVE', 'RESTORE', 'REVERSE'] as const

export type TrailEvent = {
  name: string
  action: string
  at: Date
}

/** Who first recorded a row, and who last changed it when that is a later event. */
export type Trail = {
  entered: TrailEvent | null
  changed: TrailEvent | null
}

/**
 * The people behind a set of records, read from the audit log.
 * One query covers a whole page of rows.
 */
export async function trailsFor(ctx: OrgContext, entityIds: string[]): Promise<Map<string, Trail>> {
  const ids = [...new Set(entityIds.filter(Boolean))]
  const map = new Map<string, Trail>()
  for (const id of ids) map.set(id, { entered: null, changed: null })
  if (ids.length === 0) return map

  const rows = await db.auditLog.findMany({
    where: {
      orgId: ctx.orgId,
      entityId: { in: ids },
      action: { in: [...TRAIL_ACTIONS] },
    },
    select: {
      entityId: true,
      action: true,
      at: true,
      actor: { select: { name: true } },
    },
    orderBy: { at: 'asc' },
  })

  for (const row of rows) {
    const event: TrailEvent = {
      name: row.actor?.name ?? 'System',
      action: row.action,
      at: row.at,
    }
    const current = map.get(row.entityId) ?? { entered: null, changed: null }
    if (!current.entered) current.entered = event
    current.changed = event
    map.set(row.entityId, current)
  }

  for (const trail of map.values()) {
    if (
      trail.entered &&
      trail.changed &&
      trail.entered.at.getTime() === trail.changed.at.getTime() &&
      trail.entered.action === trail.changed.action
    ) {
      trail.changed = null
    }
  }

  return map
}

export async function trailFor(ctx: OrgContext, entityId: string): Promise<Trail> {
  const map = await trailsFor(ctx, [entityId])
  return map.get(entityId) ?? { entered: null, changed: null }
}

export async function list(ctx: OrgContext, query: ListQuery) {
  const where: Prisma.AuditLogWhereInput = {
    orgId: ctx.orgId,
    ...(query.q
      ? {
          OR: [
            { entity: { contains: query.q, mode: 'insensitive' } },
            { actor: { name: { contains: query.q, mode: 'insensitive' } } },
            { actor: { email: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      select: {
        id: true,
        entity: true,
        entityId: true,
        action: true,
        at: true,
        ipAddress: true,
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { at: 'desc' },
      ...paginate(query),
    }),
    db.auditLog.count({ where }),
  ])

  return paged(rows, total, query)
}

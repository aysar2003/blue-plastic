import 'server-only'
import type { Prisma } from '@prisma/client'

import { presentTrashEntry } from '@/lib/trash-log'
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

/**
 * Trash: every deletion, and nothing else.
 *
 * The working books no longer contain these records. This list is the log of
 * the fact that they were deleted — who, what, and why — with no id and no
 * path back to a page that would open them.
 */
export async function list(ctx: OrgContext, query: ListQuery) {
  const q = query.q?.trim()
  const needle = q ? [q, q.toUpperCase()].filter((value, index, all) => all.indexOf(value) === index) : []

  const where: Prisma.AuditLogWhereInput = {
    orgId: ctx.orgId,
    action: 'DELETE',
    // Restored or cleared rows leave Trash; ledger soft-deletes stay in the database.
    AND: [
      { NOT: { after: { path: ['restored'], equals: true } } },
      { NOT: { after: { path: ['cleared'], equals: true } } },
    ],
    ...(needle.length
      ? {
          OR: needle.flatMap((value) => [
            { actor: { name: { contains: value, mode: 'insensitive' as const } } },
            { actor: { email: { contains: value, mode: 'insensitive' as const } } },
            { entity: { contains: value, mode: 'insensitive' as const } },
            { before: { path: ['number'], string_contains: value } },
            { before: { path: ['displayName'], string_contains: value } },
            { before: { path: ['name'], string_contains: value } },
            { before: { path: ['email'], string_contains: value } },
            { before: { path: ['sku'], string_contains: value } },
            { before: { path: ['entries'], array_contains: value } },
            { after: { path: ['reason'], string_contains: value } },
          ]),
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      select: {
        id: true,
        entity: true,
        at: true,
        before: true,
        after: true,
        actor: { select: { name: true, email: true } },
      },
      orderBy: { at: 'desc' },
      ...paginate(query),
    }),
    db.auditLog.count({ where }),
  ])

  return paged(
    rows.map((row) => presentTrashEntry(row)),
    total,
    query,
  )
}

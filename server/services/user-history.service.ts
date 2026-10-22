import 'server-only'
import type { Prisma } from '@prisma/client'

import {
  actionLabel,
  entityLabel,
  userHistoryDetail,
  userHistoryHref,
  userHistoryRetentionStart,
} from '@/lib/user-history'
import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export type UserHistoryRow = {
  id: string
  at: Date
  action: string
  actionLabel: string
  entity: string
  entityLabel: string
  detail: string | null
  href: string | null
  who: string
  email: string | null
  actorId: string | null
  ipAddress: string | null
}

/**
 * Drop sign-in / sign-out rows older than one year for this company.
 * Transaction audit (including Trash) is left alone.
 */
export async function pruneExpiredAuthEvents(orgId: string): Promise<void> {
  try {
    await db.auditLog.deleteMany({
      where: {
        orgId,
        action: { in: ['LOGIN', 'LOGIN_FAILED', 'LOGOUT'] },
        at: { lt: userHistoryRetentionStart() },
      },
    })
  } catch (error) {
    console.error('[user-history] prune failed', error)
  }
}

/** Members of this company — for the history filter. */
export async function listMembers(ctx: OrgContext) {
  const rows = await db.membership.findMany({
    where: { orgId: ctx.orgId },
    select: {
      userId: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { user: { name: 'asc' } },
  })
  return rows.map((row) => ({
    id: row.userId,
    name: row.user.name,
    email: row.user.email,
  }))
}

/**
 * One year of sign-ins, sign-outs, and work this person (or everyone) recorded.
 */
export async function list(
  ctx: OrgContext,
  query: ListQuery & { userId?: string | null; action?: string | null },
) {
  // Do not block the read on prune — fire-and-forget so the history page stays fast.
  void pruneExpiredAuthEvents(ctx.orgId)

  const since = userHistoryRetentionStart()
  const q = query.q?.trim()
  const userId = query.userId?.trim() || null
  const action = query.action?.trim().toUpperCase() || null

  const where: Prisma.AuditLogWhereInput = {
    orgId: ctx.orgId,
    at: { gte: since },
    actorId: userId ? userId : { not: null },
    ...(action ? { action: action as Prisma.AuditLogWhereInput['action'] } : {}),
    ...(q
      ? {
          OR: [
            { actor: { name: { contains: q, mode: 'insensitive' } } },
            { actor: { email: { contains: q, mode: 'insensitive' } } },
            { entity: { contains: q, mode: 'insensitive' } },
            { before: { path: ['number'], string_contains: q } },
            { after: { path: ['number'], string_contains: q } },
            { before: { path: ['displayName'], string_contains: q } },
            { after: { path: ['displayName'], string_contains: q } },
            { before: { path: ['name'], string_contains: q } },
            { after: { path: ['name'], string_contains: q } },
          ],
        }
      : {}),
  }

  const { skip, take } = paginate(query)
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      select: {
        id: true,
        at: true,
        action: true,
        entity: true,
        entityId: true,
        before: true,
        after: true,
        actorId: true,
        ipAddress: true,
        actor: { select: { name: true, email: true } },
      },
      orderBy: { at: 'desc' },
      skip,
      take,
    }),
  ])

  const presented: UserHistoryRow[] = rows.map((row) => ({
    id: row.id,
    at: row.at,
    action: row.action,
    actionLabel: actionLabel(row.action),
    entity: row.entity,
    entityLabel: entityLabel(row.entity),
    detail: userHistoryDetail(row.after, row.before),
    href: userHistoryHref(row.action, row.entity, row.entityId, row.after, row.before),
    who: row.actor?.name ?? 'System',
    email: row.actor?.email ?? null,
    actorId: row.actorId,
    ipAddress: row.ipAddress,
  }))

  return paged(presented, total, query)
}

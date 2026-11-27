import 'server-only'

import type { Prisma } from '@prisma/client'

import { formatDateTime } from '@/lib/date'
import { ROLE_LABELS } from '@/lib/roles'
import {
  USER_HISTORY_ACTION_LABEL,
  USER_HISTORY_ENTITY_LABEL,
  userHistoryDetail,
} from '@/lib/user-history'
import {
  actionWeight,
  assignPerformanceBand,
  isWorkAction,
  medianOf,
  performancePeriodStart,
  type PerformanceBand,
  type PerformancePeriodDays,
} from '@/lib/user-performance'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound } from '@/server/errors'

export type TeamPerformanceRow = {
  userId: string
  membershipId: string
  name: string
  email: string
  role: string
  roleLabel: string
  status: string
  score: number
  band: PerformanceBand
  rank: number
  activeDays: number
  workActions: number
  counts: {
    created: number
    updated: number
    posted: number
    approved: number
    logins: number
  }
  lastActiveAt: Date | null
  lastActiveLabel: string
}

export type PersonActivityItem = {
  id: string
  at: Date
  atLabel: string
  action: string
  actionLabel: string
  entity: string
  entityLabel: string
  detail: string | null
}

export type PersonPerformance = TeamPerformanceRow & {
  activity: PersonActivityItem[]
  breakdown: { action: string; label: string; count: number; weight: number; points: number }[]
}

function atSinceFilter(since: Date): Prisma.DateTimeFilter {
  return { gte: since }
}

type MemberLite = {
  id: string
  role: string
  status: string
  user: { id: string; name: string; email: string }
}

async function loadStaffMembers(orgId: string): Promise<MemberLite[]> {
  return db.membership.findMany({
    where: { orgId, role: { not: 'CUSTOMER' } },
    select: {
      id: true,
      role: true,
      status: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ user: { name: 'asc' } }],
  })
}

type Agg = {
  byAction: Map<string, number>
  loginDays: Set<string>
  workActions: number
  lastActiveAt: Date | null
}

function emptyAgg(): Agg {
  return {
    byAction: new Map(),
    loginDays: new Set(),
    workActions: 0,
    lastActiveAt: null,
  }
}

async function aggregateAudit(
  orgId: string,
  since: Date,
  actorIds: string[],
): Promise<Map<string, Agg>> {
  const map = new Map<string, Agg>()
  if (actorIds.length === 0) return map

  const at = atSinceFilter(since)

  const groups = await db.auditLog.groupBy({
    by: ['actorId', 'action'],
    where: {
      orgId,
      at,
      actorId: { in: actorIds },
    },
    _count: { _all: true },
    _max: { at: true },
  })

  for (const row of groups) {
    if (!row.actorId) continue
    let agg = map.get(row.actorId)
    if (!agg) {
      agg = emptyAgg()
      map.set(row.actorId, agg)
    }
    agg.byAction.set(row.action, row._count._all)
    if (isWorkAction(row.action)) {
      agg.workActions += row._count._all
    }
    const maxAt = row._max.at
    if (maxAt && (!agg.lastActiveAt || maxAt > agg.lastActiveAt)) {
      agg.lastActiveAt = maxAt
    }
  }

  const logins = await db.auditLog.findMany({
    where: {
      orgId,
      at,
      actorId: { in: actorIds },
      action: 'LOGIN',
    },
    select: { actorId: true, at: true },
  })
  for (const row of logins) {
    if (!row.actorId) continue
    let agg = map.get(row.actorId)
    if (!agg) {
      agg = emptyAgg()
      map.set(row.actorId, agg)
    }
    agg.loginDays.add(row.at.toISOString().slice(0, 10))
    if (!agg.lastActiveAt || row.at > agg.lastActiveAt) {
      agg.lastActiveAt = row.at
    }
  }

  return map
}

function scoreFromAgg(agg: Agg | undefined): {
  score: number
  activeDays: number
  workActions: number
  counts: TeamPerformanceRow['counts']
  lastActiveAt: Date | null
} {
  if (!agg) {
    return {
      score: 0,
      activeDays: 0,
      workActions: 0,
      counts: { created: 0, updated: 0, posted: 0, approved: 0, logins: 0 },
      lastActiveAt: null,
    }
  }

  let score = 0
  for (const [action, count] of agg.byAction) {
    if (action === 'LOGIN') continue
    score += actionWeight(action) * count
  }
  const loginDays = agg.loginDays.size
  score += loginDays * actionWeight('LOGIN')

  return {
    score,
    activeDays: loginDays,
    workActions: agg.workActions,
    counts: {
      created: agg.byAction.get('CREATE') ?? 0,
      updated: agg.byAction.get('UPDATE') ?? 0,
      posted: agg.byAction.get('POST') ?? 0,
      approved: agg.byAction.get('APPROVE') ?? 0,
      logins: loginDays,
    },
    lastActiveAt: agg.lastActiveAt,
  }
}

export async function listTeamPerformance(
  ctx: OrgContext,
  input: { days: PerformancePeriodDays },
): Promise<{ days: PerformancePeriodDays; rows: TeamPerformanceRow[] }> {
  const since = performancePeriodStart(input.days)
  const members = await loadStaffMembers(ctx.orgId)
  const actorIds = members.map((m) => m.user.id)
  const aggs = await aggregateAudit(ctx.orgId, since, actorIds)

  const scored = members.map((member) => {
    const stats = scoreFromAgg(aggs.get(member.user.id))
    return { member, ...stats }
  })

  const medianScore = medianOf(scored.filter((r) => r.workActions > 0).map((r) => r.score))

  const withBands = scored.map((row) => {
    const band = assignPerformanceBand({
      score: row.score,
      workActions: row.workActions,
      activeDays: row.activeDays,
      medianScore,
    })
    return {
      userId: row.member.user.id,
      membershipId: row.member.id,
      name: row.member.user.name,
      email: row.member.user.email,
      role: row.member.role,
      roleLabel: ROLE_LABELS[row.member.role as keyof typeof ROLE_LABELS] ?? row.member.role,
      status: row.member.status,
      score: row.score,
      band,
      rank: 0,
      activeDays: row.activeDays,
      workActions: row.workActions,
      counts: row.counts,
      lastActiveAt: row.lastActiveAt,
      lastActiveLabel: row.lastActiveAt
        ? formatDateTime(row.lastActiveAt, ctx.organization.timeZone)
        : '—',
    } satisfies TeamPerformanceRow
  })

  withBands.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.activeDays !== a.activeDays) return b.activeDays - a.activeDays
    return a.name.localeCompare(b.name)
  })

  withBands.forEach((row, index) => {
    row.rank = index + 1
  })

  return { days: input.days, rows: withBands }
}

export async function getPersonActivity(
  ctx: OrgContext,
  userId: string,
  input: { days: PerformancePeriodDays },
): Promise<{
  activity: PersonActivityItem[]
  breakdown: PersonPerformance['breakdown']
}> {
  const since = performancePeriodStart(input.days)
  const at = atSinceFilter(since)

  const [logs, groups] = await Promise.all([
    db.auditLog.findMany({
      where: {
        orgId: ctx.orgId,
        actorId: userId,
        at,
      } satisfies Prisma.AuditLogWhereInput,
      orderBy: { at: 'desc' },
      take: 40,
      select: {
        id: true,
        at: true,
        action: true,
        entity: true,
        before: true,
        after: true,
      },
    }),
    db.auditLog.groupBy({
      by: ['action'],
      where: {
        orgId: ctx.orgId,
        actorId: userId,
        at,
      },
      _count: { _all: true },
    }),
  ])

  const breakdown = groups
    .map((g) => {
      const weight = actionWeight(g.action)
      const count = g._count._all
      return {
        action: g.action,
        label: USER_HISTORY_ACTION_LABEL[g.action] ?? g.action,
        count,
        weight,
        points: weight * count,
      }
    })
    .filter((g) => g.count > 0)
    .sort((a, b) => b.points - a.points || b.count - a.count)

  const activity: PersonActivityItem[] = logs.map((log) => ({
    id: log.id,
    at: log.at,
    atLabel: formatDateTime(log.at, ctx.organization.timeZone),
    action: log.action,
    actionLabel: USER_HISTORY_ACTION_LABEL[log.action] ?? log.action,
    entity: log.entity,
    entityLabel: USER_HISTORY_ENTITY_LABEL[log.entity] ?? log.entity,
    detail: userHistoryDetail(log.after, log.before),
  }))

  return { activity, breakdown }
}

export async function getPersonPerformance(
  ctx: OrgContext,
  userId: string,
  input: { days: PerformancePeriodDays },
): Promise<PersonPerformance> {
  const { rows } = await listTeamPerformance(ctx, input)
  const row = rows.find((r) => r.userId === userId)
  if (!row) throw notFound('Member')
  const detail = await getPersonActivity(ctx, userId, input)
  return { ...row, ...detail }
}

/** Lightweight map for Company users strip. */
export async function performanceSummaryByUserId(
  ctx: OrgContext,
  days: PerformancePeriodDays = 30,
): Promise<Record<string, { score: number; band: PerformanceBand; rank: number }>> {
  const { rows } = await listTeamPerformance(ctx, { days })
  const out: Record<string, { score: number; band: PerformanceBand; rank: number }> = {}
  for (const row of rows) {
    out[row.userId] = { score: row.score, band: row.band, rank: row.rank }
  }
  return out
}

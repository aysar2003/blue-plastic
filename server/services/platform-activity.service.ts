import 'server-only'

import { Prisma } from '@prisma/client'

import { formatDateTime } from '@/lib/date'
import {
  MODULE_FLAGS,
  MODULE_FLAG_LABELS,
  type ModuleFlag,
} from '@/lib/feature-flags'
import {
  USER_HISTORY_ACTION_LABEL,
  USER_HISTORY_ENTITY_LABEL,
  userHistoryDetail,
} from '@/lib/user-history'
import {
  actionWeight,
  assignPerformanceBand,
  isAllPerformanceDays,
  isWorkAction,
  medianOf,
  performanceChartDays,
  performancePeriodStart,
  type PerformanceBand,
  type PerformancePeriodDays,
} from '@/lib/user-performance'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden } from '@/server/errors'
import { listUserDatabases } from '@/server/services/backup-import.service'

function assertSystemOwner(ctx: OrgContext) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can open platform activity.')
  }
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function emptyDayKeys(days: PerformancePeriodDays): string[] {
  const keys: string[] = []
  const cursor = performancePeriodStart(performanceChartDays(days))
  const end = new Date()
  end.setUTCHours(0, 0, 0, 0)
  while (cursor <= end) {
    keys.push(dayKey(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return keys
}

function atSinceFilter(since: Date): Prisma.DateTimeFilter {
  return { gte: since }
}

export type NamedCount = {
  key: string
  label: string
  count: number
}

export type DailyVolumePoint = {
  day: string
  events: number
  work: number
  logins: number
  failedLogins: number
  activeUsers: number
  activeCompanies: number
}

export type PlatformCompanyUsage = {
  orgId: string
  name: string
  sizeBytes: number
  activeUsers: number
  maxUsers: number | null
  seatUtilizationPct: number | null
  auditEvents: number
  prevAuditEvents: number
  eventsDeltaPct: number | null
  workEvents: number
  logins: number
  failedLogins: number
  uniqueActors: number
  customers: number
  vendors: number
  items: number
  salesDocs: number
  purchaseDocs: number
  modulesOn: number
  modules: Record<string, boolean>
  lastActiveAt: Date | null
  lastActiveLabel: string
  openBlocked: boolean
  rentExpired: boolean
  onTrial: boolean
  daysLeft: number | null
  quiet: boolean
  activityDrop: boolean
  riskFlags: string[]
}

export type PlatformUserActivityRow = {
  userId: string
  name: string
  email: string
  score: number
  band: PerformanceBand
  rank: number
  activeDays: number
  workActions: number
  eventCount: number
  companyNames: string[]
  companyCount: number
  twoFactorOn: boolean
  counts: {
    created: number
    updated: number
    posted: number
    approved: number
    logins: number
    failedLogins: number
  }
  topAction: string | null
  topActionLabel: string | null
  lastActiveAt: Date | null
  lastActiveLabel: string
}

export type PlatformActivityEvent = {
  id: string
  at: Date
  atLabel: string
  action: string
  actionLabel: string
  entity: string
  entityLabel: string
  detail: string | null
  actorId: string | null
  actorName: string
  orgId: string
  orgName: string
  ipAddress: string | null
}

export type SuspiciousIpRow = {
  ipAddress: string
  failedCount: number
  companyNames: string[]
  lastAtLabel: string
}

export type FeatureAdoptionRow = {
  key: string
  label: string
  companiesOn: number
  pct: number
}

export type AttentionItem = {
  kind: 'company' | 'security'
  severity: 'high' | 'medium'
  title: string
  detail: string
  href: string
}

export type PlatformActivityInsights = {
  quietCompanies: number
  activeCompanies: number
  uniqueActors: number
  workEvents: number
  loginEvents: number
  failedLogins: number
  busiestCompanyName: string | null
  busiestCompanyEvents: number
  heaviestCompanyName: string | null
  heaviestCompanyBytes: number
  topUserName: string | null
  topUserScore: number
  previousPeriodEvents: number
  eventsDeltaPct: number | null
  bandCounts: Record<PerformanceBand, number>
  newCompanies: number
  newUsers: number
  twoFactorOn: number
  twoFactorOff: number
  twoFactorPct: number
  avgDailyActiveUsers: number
  peakDailyActiveUsers: number
  activityDropCompanies: number
  suspiciousIpCount: number
}

export type PlatformActivityTotals = {
  companies: number
  activeStaff: number
  totalSizeBytes: number
  auditEvents: number
  days: PerformancePeriodDays
}

export type PlatformActivitySnapshot = {
  days: PerformancePeriodDays
  totals: PlatformActivityTotals
  insights: PlatformActivityInsights
  daily: DailyVolumePoint[]
  actionMix: NamedCount[]
  entityMix: NamedCount[]
  featureAdoption: FeatureAdoptionRow[]
  suspiciousIps: SuspiciousIpRow[]
  attention: AttentionItem[]
  companies: PlatformCompanyUsage[]
  users: PlatformUserActivityRow[]
  events: PlatformActivityEvent[]
}

function emptyInsights(): PlatformActivityInsights {
  return {
    quietCompanies: 0,
    activeCompanies: 0,
    uniqueActors: 0,
    workEvents: 0,
    loginEvents: 0,
    failedLogins: 0,
    busiestCompanyName: null,
    busiestCompanyEvents: 0,
    heaviestCompanyName: null,
    heaviestCompanyBytes: 0,
    topUserName: null,
    topUserScore: 0,
    previousPeriodEvents: 0,
    eventsDeltaPct: null,
    bandCounts: { top: 0, steady: 0, low: 0, inactive: 0 },
    newCompanies: 0,
    newUsers: 0,
    twoFactorOn: 0,
    twoFactorOff: 0,
    twoFactorPct: 0,
    avgDailyActiveUsers: 0,
    peakDailyActiveUsers: 0,
    activityDropCompanies: 0,
    suspiciousIpCount: 0,
  }
}

function countModulesOn(modules: Record<string, boolean> | undefined): number {
  if (!modules) return 0
  return Object.values(modules).filter(Boolean).length
}

function deltaPct(current: number, previous: number): number | null {
  if (previous > 0) return Math.round(((current - previous) / previous) * 100)
  if (current > 0) return 100
  return null
}

export async function getPlatformActivity(
  ctx: OrgContext,
  input: { days: PerformancePeriodDays; eventLimit?: number },
): Promise<PlatformActivitySnapshot> {
  assertSystemOwner(ctx)

  const days = input.days
  const allTime = isAllPerformanceDays(days)
  const since = performancePeriodStart(days)
  const prevSince = allTime ? null : performancePeriodStart(days * 2)
  const eventLimit = input.eventLimit ?? 80
  const atFilter = atSinceFilter(since)
  const chartSince = performancePeriodStart(performanceChartDays(days))

  const databases = await listUserDatabases(ctx)
  const orgIds = databases.map((row) => row.id)
  const orgNameById = new Map(databases.map((row) => [row.id, row.name]))

  if (orgIds.length === 0) {
    return {
      days,
      totals: {
        companies: 0,
        activeStaff: 0,
        totalSizeBytes: 0,
        auditEvents: 0,
        days,
      },
      insights: emptyInsights(),
      daily: [],
      actionMix: [],
      entityMix: [],
      featureAdoption: [],
      suspiciousIps: [],
      attention: [],
      companies: [],
      users: [],
      events: [],
    }
  }

  const wherePeriod: Prisma.AuditLogWhereInput = {
    orgId: { in: orgIds },
    at: atFilter,
  }
  const wherePrevPeriod: Prisma.AuditLogWhereInput | null = prevSince
    ? { orgId: { in: orgIds }, at: { gte: prevSince, lt: since } }
    : null

  const [
    auditByOrg,
    prevAuditByOrg,
    lastByOrg,
    actionByOrg,
    actionGroups,
    actionPlatform,
    entityPlatform,
    loginRows,
    failedLoginRows,
    recentLogs,
    staffCount,
    prevPeriodCount,
    customersByOrg,
    vendorsByOrg,
    itemsByOrg,
    salesByOrg,
    purchasesByOrg,
    dailyRaw,
    newCompaniesCount,
    newUsersCount,
    staffSecurity,
  ] = await Promise.all([
    db.auditLog.groupBy({
      by: ['orgId'],
      where: wherePeriod,
      _count: { _all: true },
    }),
    wherePrevPeriod
      ? db.auditLog.groupBy({
          by: ['orgId'],
          where: wherePrevPeriod,
          _count: { _all: true },
        })
      : Promise.resolve([] as { orgId: string; _count: { _all: number } }[]),
    db.auditLog.groupBy({
      by: ['orgId'],
      where: { orgId: { in: orgIds } },
      _max: { at: true },
    }),
    db.auditLog.groupBy({
      by: ['orgId', 'action'],
      where: wherePeriod,
      _count: { _all: true },
    }),
    db.auditLog.groupBy({
      by: ['actorId', 'action'],
      where: { ...wherePeriod, actorId: { not: null } },
      _count: { _all: true },
      _max: { at: true },
    }),
    db.auditLog.groupBy({
      by: ['action'],
      where: wherePeriod,
      _count: { _all: true },
    }),
    db.auditLog.groupBy({
      by: ['entity'],
      where: {
        ...wherePeriod,
        action: { notIn: ['LOGIN', 'LOGIN_FAILED', 'LOGOUT'] },
      },
      _count: { _all: true },
    }),
    db.auditLog.findMany({
      where: { ...wherePeriod, action: 'LOGIN', actorId: { not: null } },
      select: { actorId: true, at: true, orgId: true },
    }),
    db.auditLog.findMany({
      where: { ...wherePeriod, action: 'LOGIN_FAILED' },
      select: { at: true, orgId: true, actorId: true, ipAddress: true },
    }),
    db.auditLog.findMany({
      where: wherePeriod,
      orderBy: { at: 'desc' },
      take: eventLimit,
      select: {
        id: true,
        at: true,
        action: true,
        entity: true,
        before: true,
        after: true,
        actorId: true,
        orgId: true,
        ipAddress: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    }),
    db.membership.count({
      where: {
        orgId: { in: orgIds },
        role: { not: 'CUSTOMER' },
        status: 'ACTIVE',
      },
    }),
    wherePrevPeriod
      ? db.auditLog.count({ where: wherePrevPeriod })
      : Promise.resolve(0),
    db.customer.groupBy({
      by: ['orgId'],
      where: { orgId: { in: orgIds } },
      _count: { _all: true },
    }),
    db.vendor.groupBy({
      by: ['orgId'],
      where: { orgId: { in: orgIds } },
      _count: { _all: true },
    }),
    db.item.groupBy({
      by: ['orgId'],
      where: { orgId: { in: orgIds } },
      _count: { _all: true },
    }),
    db.salesDocument.groupBy({
      by: ['orgId'],
      where: { orgId: { in: orgIds } },
      _count: { _all: true },
    }),
    db.purchaseDocument.groupBy({
      by: ['orgId'],
      where: { orgId: { in: orgIds } },
      _count: { _all: true },
    }),
    db.$queryRaw<{ day: Date; action: string; n: bigint }[]>`
      SELECT date_trunc('day', at AT TIME ZONE 'UTC') AS day,
             action::text AS action,
             COUNT(*)::bigint AS n
        FROM audit_logs
       WHERE "orgId" IN (${Prisma.join(orgIds)})
         AND at >= ${chartSince}
       GROUP BY 1, 2
       ORDER BY 1 ASC
    `,
    db.organization.count({
      where: { id: { in: orgIds }, createdAt: { gte: since } },
    }),
    db.user.count({
      where: {
        createdAt: { gte: since },
        memberships: { some: { orgId: { in: orgIds }, role: { not: 'CUSTOMER' } } },
      },
    }),
    db.user.findMany({
      where: {
        memberships: {
          some: { orgId: { in: orgIds }, role: { not: 'CUSTOMER' }, status: 'ACTIVE' },
        },
      },
      select: {
        id: true,
        totpEnabledAt: true,
        otp2faEnabledAt: true,
      },
    }),
  ])

  const auditCountByOrg = new Map(auditByOrg.map((row) => [row.orgId, row._count._all]))
  const prevAuditCountByOrg = new Map(prevAuditByOrg.map((row) => [row.orgId, row._count._all]))
  const lastAtByOrg = new Map(lastByOrg.map((row) => [row.orgId, row._max.at ?? null]))
  const customersMap = new Map(customersByOrg.map((r) => [r.orgId, r._count._all]))
  const vendorsMap = new Map(vendorsByOrg.map((r) => [r.orgId, r._count._all]))
  const itemsMap = new Map(itemsByOrg.map((r) => [r.orgId, r._count._all]))
  const salesMap = new Map(salesByOrg.map((r) => [r.orgId, r._count._all]))
  const purchasesMap = new Map(purchasesByOrg.map((r) => [r.orgId, r._count._all]))

  type OrgActionAgg = { work: number; logins: number; failed: number }
  const orgAction = new Map<string, OrgActionAgg>()
  for (const row of actionByOrg) {
    let agg = orgAction.get(row.orgId)
    if (!agg) {
      agg = { work: 0, logins: 0, failed: 0 }
      orgAction.set(row.orgId, agg)
    }
    if (row.action === 'LOGIN') agg.logins += row._count._all
    else if (row.action === 'LOGIN_FAILED') agg.failed += row._count._all
    else if (isWorkAction(row.action)) agg.work += row._count._all
  }

  const actorsByOrg = new Map<string, Set<string>>()
  for (const row of loginRows) {
    if (!row.actorId) continue
    let set = actorsByOrg.get(row.orgId)
    if (!set) {
      set = new Set()
      actorsByOrg.set(row.orgId, set)
    }
    set.add(row.actorId)
  }

  const companies: PlatformCompanyUsage[] = databases
    .map((row) => {
      const lastActiveAt = lastAtByOrg.get(row.id) ?? null
      const oa = orgAction.get(row.id)
      const events = auditCountByOrg.get(row.id) ?? 0
      const prevEvents = prevAuditCountByOrg.get(row.id) ?? 0
      const eventsDelta = deltaPct(events, prevEvents)
      const activityDrop =
        prevEvents >= 10 && events < prevEvents * 0.5
      const seatUtilizationPct =
        row.maxUsers && row.maxUsers > 0
          ? Math.round((row.activeUsers / row.maxUsers) * 100)
          : null
      const riskFlags: string[] = []
      if (row.openBlocked) riskFlags.push('Blocked')
      if (row.rentExpired) riskFlags.push('Rent expired')
      if (events === 0) riskFlags.push('Quiet')
      if (activityDrop) riskFlags.push('Activity drop')
      if ((oa?.failed ?? 0) >= 5) riskFlags.push('Failed sign-ins')
      if (seatUtilizationPct != null && seatUtilizationPct >= 90) riskFlags.push('Seats nearly full')

      return {
        orgId: row.id,
        name: row.name,
        sizeBytes: row.sizeBytes,
        activeUsers: row.activeUsers,
        maxUsers: row.maxUsers,
        seatUtilizationPct,
        auditEvents: events,
        prevAuditEvents: prevEvents,
        eventsDeltaPct: eventsDelta,
        workEvents: oa?.work ?? 0,
        logins: oa?.logins ?? 0,
        failedLogins: oa?.failed ?? 0,
        uniqueActors: actorsByOrg.get(row.id)?.size ?? 0,
        customers: customersMap.get(row.id) ?? 0,
        vendors: vendorsMap.get(row.id) ?? 0,
        items: itemsMap.get(row.id) ?? 0,
        salesDocs: salesMap.get(row.id) ?? 0,
        purchaseDocs: purchasesMap.get(row.id) ?? 0,
        modulesOn: countModulesOn(row.modules),
        modules: row.modules,
        lastActiveAt,
        lastActiveLabel: lastActiveAt
          ? formatDateTime(lastActiveAt, ctx.organization.timeZone)
          : '—',
        openBlocked: row.openBlocked,
        rentExpired: row.rentExpired,
        onTrial: row.onTrial,
        daysLeft: row.daysLeft,
        quiet: events === 0,
        activityDrop,
        riskFlags,
      }
    })
    .sort((a, b) => b.sizeBytes - a.sizeBytes || b.auditEvents - a.auditEvents)

  type ActorAgg = {
    byAction: Map<string, number>
    loginDays: Set<string>
    workActions: number
    eventCount: number
    orgIds: Set<string>
    lastActiveAt: Date | null
  }

  const byActor = new Map<string, ActorAgg>()

  for (const row of actionGroups) {
    if (!row.actorId) continue
    let agg = byActor.get(row.actorId)
    if (!agg) {
      agg = {
        byAction: new Map(),
        loginDays: new Set(),
        workActions: 0,
        eventCount: 0,
        orgIds: new Set(),
        lastActiveAt: null,
      }
      byActor.set(row.actorId, agg)
    }
    agg.byAction.set(row.action, row._count._all)
    agg.eventCount += row._count._all
    if (isWorkAction(row.action)) agg.workActions += row._count._all
    const at = row._max.at
    if (at && (!agg.lastActiveAt || at > agg.lastActiveAt)) agg.lastActiveAt = at
  }

  for (const row of loginRows) {
    if (!row.actorId) continue
    let agg = byActor.get(row.actorId)
    if (!agg) {
      agg = {
        byAction: new Map(),
        loginDays: new Set(),
        workActions: 0,
        eventCount: 0,
        orgIds: new Set(),
        lastActiveAt: null,
      }
      byActor.set(row.actorId, agg)
    }
    agg.loginDays.add(dayKey(row.at))
    agg.orgIds.add(row.orgId)
    if (!agg.lastActiveAt || row.at > agg.lastActiveAt) agg.lastActiveAt = row.at
  }

  const actorIds = [...byActor.keys()]
  const twoFactorByUser = new Map(
    staffSecurity.map((u) => [
      u.id,
      Boolean(u.totpEnabledAt || u.otp2faEnabledAt),
    ]),
  )

  const [users, memberships] = await Promise.all([
    actorIds.length === 0
      ? Promise.resolve([])
      : db.user.findMany({
          where: { id: { in: actorIds } },
          select: {
            id: true,
            name: true,
            email: true,
            totpEnabledAt: true,
            otp2faEnabledAt: true,
          },
        }),
    actorIds.length === 0
      ? Promise.resolve([])
      : db.membership.findMany({
          where: {
            userId: { in: actorIds },
            orgId: { in: orgIds },
            role: { not: 'CUSTOMER' },
          },
          select: { userId: true, orgId: true },
        }),
  ])

  for (const row of memberships) {
    const agg = byActor.get(row.userId)
    if (agg) agg.orgIds.add(row.orgId)
    let set = actorsByOrg.get(row.orgId)
    if (!set) {
      set = new Set()
      actorsByOrg.set(row.orgId, set)
    }
    set.add(row.userId)
  }

  for (const log of recentLogs) {
    if (!log.actorId) continue
    const agg = byActor.get(log.actorId)
    if (agg) agg.orgIds.add(log.orgId)
  }

  for (const company of companies) {
    company.uniqueActors = actorsByOrg.get(company.orgId)?.size ?? company.uniqueActors
  }

  const userById = new Map(users.map((u) => [u.id, u]))

  const scored: PlatformUserActivityRow[] = actorIds.map((userId) => {
    const agg = byActor.get(userId)!
    let score = 0
    let topAction: string | null = null
    let topCount = 0
    for (const [action, count] of agg.byAction) {
      if (action === 'LOGIN') continue
      score += actionWeight(action) * count
      if (count > topCount && isWorkAction(action)) {
        topCount = count
        topAction = action
      }
    }
    const activeDays = agg.loginDays.size
    score += activeDays * actionWeight('LOGIN')
    const user = userById.get(userId)
    const companyNames = [...agg.orgIds]
      .map((id) => orgNameById.get(id))
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b))
    const twoFactorOn =
      Boolean(user?.totpEnabledAt || user?.otp2faEnabledAt) ||
      twoFactorByUser.get(userId) === true

    return {
      userId,
      name: user?.name ?? 'Unknown',
      email: user?.email ?? '',
      score,
      workActions: agg.workActions,
      activeDays,
      eventCount: agg.eventCount,
      companyNames,
      companyCount: companyNames.length,
      twoFactorOn,
      counts: {
        created: agg.byAction.get('CREATE') ?? 0,
        updated: agg.byAction.get('UPDATE') ?? 0,
        posted: agg.byAction.get('POST') ?? 0,
        approved: agg.byAction.get('APPROVE') ?? 0,
        logins: activeDays,
        failedLogins: agg.byAction.get('LOGIN_FAILED') ?? 0,
      },
      topAction,
      topActionLabel: topAction
        ? (USER_HISTORY_ACTION_LABEL[topAction] ?? topAction)
        : null,
      lastActiveAt: agg.lastActiveAt,
      lastActiveLabel: agg.lastActiveAt
        ? formatDateTime(agg.lastActiveAt, ctx.organization.timeZone)
        : '—',
      band: 'inactive',
      rank: 0,
    }
  })

  const medianScore = medianOf(scored.filter((r) => r.workActions > 0).map((r) => r.score))
  for (const row of scored) {
    row.band = assignPerformanceBand({
      score: row.score,
      workActions: row.workActions,
      activeDays: row.activeDays,
      medianScore,
    })
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.eventCount !== a.eventCount) return b.eventCount - a.eventCount
    return a.name.localeCompare(b.name)
  })
  scored.forEach((row, index) => {
    row.rank = index + 1
  })

  const events: PlatformActivityEvent[] = recentLogs.map((log) => ({
    id: log.id,
    at: log.at,
    atLabel: formatDateTime(log.at, ctx.organization.timeZone),
    action: log.action,
    actionLabel: USER_HISTORY_ACTION_LABEL[log.action] ?? log.action,
    entity: log.entity,
    entityLabel: USER_HISTORY_ENTITY_LABEL[log.entity] ?? log.entity,
    detail: userHistoryDetail(log.after, log.before),
    actorId: log.actorId,
    actorName: log.actor?.name?.trim() || log.actor?.email || 'Someone',
    orgId: log.orgId,
    orgName: orgNameById.get(log.orgId) ?? 'Company',
    ipAddress: log.ipAddress,
  }))

  const actionMix: NamedCount[] = actionPlatform
    .map((row) => ({
      key: row.action,
      label: USER_HISTORY_ACTION_LABEL[row.action] ?? row.action,
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count)

  const entityMix: NamedCount[] = entityPlatform
    .map((row) => ({
      key: row.entity,
      label: USER_HISTORY_ENTITY_LABEL[row.entity] ?? row.entity,
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  // Suspicious IPs — repeat failed sign-ins (platform security signal)
  const ipAgg = new Map<
    string,
    { count: number; orgs: Set<string>; lastAt: Date }
  >()
  for (const row of failedLoginRows) {
    const ip = row.ipAddress?.trim()
    if (!ip) continue
    let agg = ipAgg.get(ip)
    if (!agg) {
      agg = { count: 0, orgs: new Set(), lastAt: row.at }
      ipAgg.set(ip, agg)
    }
    agg.count += 1
    agg.orgs.add(row.orgId)
    if (row.at > agg.lastAt) agg.lastAt = row.at
  }
  const suspiciousIps: SuspiciousIpRow[] = [...ipAgg.entries()]
    .filter(([, v]) => v.count >= 3)
    .map(([ip, v]) => ({
      ipAddress: ip,
      failedCount: v.count,
      companyNames: [...v.orgs]
        .map((id) => orgNameById.get(id) ?? id)
        .sort((a, b) => a.localeCompare(b)),
      lastAtLabel: formatDateTime(v.lastAt, ctx.organization.timeZone),
    }))
    .sort((a, b) => b.failedCount - a.failedCount)
    .slice(0, 20)

  // Feature adoption across tenants (AWS SaaS Lens: feature consumption)
  const companyCount = companies.length || 1
  const featureAdoption: FeatureAdoptionRow[] = MODULE_FLAGS.map((flag: ModuleFlag) => {
    const companiesOn = companies.filter((c) => c.modules[flag]).length
    return {
      key: flag,
      label: MODULE_FLAG_LABELS[flag]?.label ?? flag,
      companiesOn,
      pct: Math.round((companiesOn / companyCount) * 100),
    }
  }).sort((a, b) => b.pct - a.pct || a.label.localeCompare(b.label))

  // Daily volume + DAU / active companies
  const dayBuckets = new Map<string, DailyVolumePoint>()
  for (const key of emptyDayKeys(days)) {
    dayBuckets.set(key, {
      day: key,
      events: 0,
      work: 0,
      logins: 0,
      failedLogins: 0,
      activeUsers: 0,
      activeCompanies: 0,
    })
  }
  for (const row of dailyRaw) {
    const key = dayKey(new Date(row.day))
    let point = dayBuckets.get(key)
    if (!point) {
      point = {
        day: key,
        events: 0,
        work: 0,
        logins: 0,
        failedLogins: 0,
        activeUsers: 0,
        activeCompanies: 0,
      }
      dayBuckets.set(key, point)
    }
    const n = Number(row.n)
    point.events += n
    if (row.action === 'LOGIN') point.logins += n
    else if (row.action === 'LOGIN_FAILED') point.failedLogins += n
    else if (isWorkAction(row.action)) point.work += n
  }

  const dauByDay = new Map<string, Set<string>>()
  const dacByDay = new Map<string, Set<string>>()
  for (const row of loginRows) {
    if (!row.actorId) continue
    const key = dayKey(row.at)
    let users = dauByDay.get(key)
    if (!users) {
      users = new Set()
      dauByDay.set(key, users)
    }
    users.add(row.actorId)
    let orgs = dacByDay.get(key)
    if (!orgs) {
      orgs = new Set()
      dacByDay.set(key, orgs)
    }
    orgs.add(row.orgId)
  }
  for (const [key, point] of dayBuckets) {
    point.activeUsers = dauByDay.get(key)?.size ?? 0
    point.activeCompanies = dacByDay.get(key)?.size ?? 0
  }
  const daily = [...dayBuckets.values()].sort((a, b) => a.day.localeCompare(b.day))
  const dauValues = daily.map((d) => d.activeUsers)
  const avgDailyActiveUsers =
    dauValues.length === 0
      ? 0
      : Math.round(dauValues.reduce((a, b) => a + b, 0) / dauValues.length)
  const peakDailyActiveUsers = Math.max(0, ...dauValues)

  const auditEvents = auditByOrg.reduce((sum, row) => sum + row._count._all, 0)
  const totalSizeBytes = companies.reduce((sum, row) => sum + row.sizeBytes, 0)
  const workEvents = actionMix
    .filter((a) => isWorkAction(a.key))
    .reduce((sum, a) => sum + a.count, 0)
  const loginEvents = actionMix.find((a) => a.key === 'LOGIN')?.count ?? 0
  const failedLogins = actionMix.find((a) => a.key === 'LOGIN_FAILED')?.count ?? 0

  const bandCounts: Record<PerformanceBand, number> = {
    top: 0,
    steady: 0,
    low: 0,
    inactive: 0,
  }
  for (const row of scored) bandCounts[row.band] += 1

  const busiest = [...companies].sort((a, b) => b.auditEvents - a.auditEvents)[0] ?? null
  const heaviest = companies[0] ?? null
  const topUser = scored[0] ?? null
  const activeCompanies = companies.filter((c) => !c.quiet).length
  const quietCompanies = companies.length - activeCompanies
  const activityDropCompanies = companies.filter((c) => c.activityDrop).length

  const twoFactorOn = staffSecurity.filter((u) => u.totpEnabledAt || u.otp2faEnabledAt).length
  const twoFactorOff = Math.max(0, staffSecurity.length - twoFactorOn)
  const twoFactorPct =
    staffSecurity.length === 0 ? 0 : Math.round((twoFactorOn / staffSecurity.length) * 100)

  const eventsDelta = deltaPct(auditEvents, prevPeriodCount)

  const attention: AttentionItem[] = []
  for (const company of companies) {
    if (company.riskFlags.length === 0) continue
    const high =
      company.openBlocked ||
      company.rentExpired ||
      company.activityDrop ||
      company.failedLogins >= 10
    attention.push({
      kind: 'company',
      severity: high ? 'high' : 'medium',
      title: company.name,
      detail: company.riskFlags.join(' · '),
      href: `/databases/${company.orgId}`,
    })
  }
  for (const ip of suspiciousIps.slice(0, 8)) {
    attention.push({
      kind: 'security',
      severity: ip.failedCount >= 10 ? 'high' : 'medium',
      title: `IP ${ip.ipAddress}`,
      detail: `${ip.failedCount} failed sign-ins · ${ip.companyNames.slice(0, 2).join(', ')}`,
      href: '/databases/activity?tab=security',
    })
  }
  attention.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1
    return a.title.localeCompare(b.title)
  })

  return {
    days,
    totals: {
      companies: companies.length,
      activeStaff: staffCount,
      totalSizeBytes,
      auditEvents,
      days,
    },
    insights: {
      quietCompanies,
      activeCompanies,
      uniqueActors: scored.length,
      workEvents,
      loginEvents,
      failedLogins,
      busiestCompanyName: busiest?.name ?? null,
      busiestCompanyEvents: busiest?.auditEvents ?? 0,
      heaviestCompanyName: heaviest?.name ?? null,
      heaviestCompanyBytes: heaviest?.sizeBytes ?? 0,
      topUserName: topUser?.name ?? null,
      topUserScore: topUser?.score ?? 0,
      previousPeriodEvents: prevPeriodCount,
      eventsDeltaPct: eventsDelta,
      bandCounts,
      newCompanies: newCompaniesCount,
      newUsers: newUsersCount,
      twoFactorOn,
      twoFactorOff,
      twoFactorPct,
      avgDailyActiveUsers,
      peakDailyActiveUsers,
      activityDropCompanies,
      suspiciousIpCount: suspiciousIps.length,
    },
    daily,
    actionMix,
    entityMix,
    featureAdoption,
    suspiciousIps,
    attention: attention.slice(0, 20),
    companies,
    users: scored,
    events,
  }
}

export type PlatformPersonDaily = {
  day: string
  events: number
  work: number
  logins: number
}

export type PlatformPersonActivityItem = {
  id: string
  at: Date
  atLabel: string
  action: string
  actionLabel: string
  entity: string
  entityLabel: string
  detail: string | null
  orgId: string
  orgName: string
  ipAddress: string | null
}

export type PlatformPersonReport = {
  days: PerformancePeriodDays
  score: number
  band: PerformanceBand
  rank: number
  rankedAmong: number
  activeDays: number
  workActions: number
  eventCount: number
  counts: {
    created: number
    updated: number
    posted: number
    approved: number
    logins: number
    failedLogins: number
  }
  topAction: string | null
  topActionLabel: string | null
  lastActiveAt: Date | null
  lastActiveLabel: string
  companyNames: string[]
  breakdown: {
    action: string
    label: string
    count: number
    weight: number
    points: number
  }[]
  activity: PlatformPersonActivityItem[]
  daily: PlatformPersonDaily[]
}

/**
 * Cross-company activity + performance for one login (system owner console).
 */
export async function getPlatformPersonReport(
  ctx: OrgContext,
  userId: string,
  input: { days: PerformancePeriodDays; activityLimit?: number },
): Promise<PlatformPersonReport> {
  assertSystemOwner(ctx)

  const days = input.days
  const allTime = isAllPerformanceDays(days)
  const since = performancePeriodStart(days)
  const atFilter = atSinceFilter(since)
  const chartSince = performancePeriodStart(performanceChartDays(days))
  const activityLimit = input.activityLimit ?? 40

  const databases = await listUserDatabases(ctx)
  const orgIds = databases.map((row) => row.id)
  const orgNameById = new Map(databases.map((row) => [row.id, row.name]))

  const empty: PlatformPersonReport = {
    days,
    score: 0,
    band: 'inactive',
    rank: 0,
    rankedAmong: 0,
    activeDays: 0,
    workActions: 0,
    eventCount: 0,
    counts: {
      created: 0,
      updated: 0,
      posted: 0,
      approved: 0,
      logins: 0,
      failedLogins: 0,
    },
    topAction: null,
    topActionLabel: null,
    lastActiveAt: null,
    lastActiveLabel: '—',
    companyNames: [],
    breakdown: [],
    activity: [],
    daily: emptyDayKeys(days).map((day) => ({ day, events: 0, work: 0, logins: 0 })),
  }

  if (orgIds.length === 0) return empty

  const wherePerson: Prisma.AuditLogWhereInput = {
    orgId: { in: orgIds },
    at: atFilter,
    actorId: userId,
  }

  const wherePeriodActors: Prisma.AuditLogWhereInput = {
    orgId: { in: orgIds },
    at: atFilter,
    actorId: { not: null },
  }

  // Peer ranking across the whole installation for "All" is too heavy — skip it.
  const [actionGroups, personLogs, loginDayRows, actorActionGroups, memberships, dailyRaw] =
    await Promise.all([
      db.auditLog.groupBy({
        by: ['action'],
        where: wherePerson,
        _count: { _all: true },
        _max: { at: true },
      }),
      db.auditLog.findMany({
        where: wherePerson,
        orderBy: { at: 'desc' },
        take: activityLimit,
        select: {
          id: true,
          at: true,
          action: true,
          entity: true,
          before: true,
          after: true,
          orgId: true,
          ipAddress: true,
        },
      }),
      db.$queryRaw<{ day: Date }[]>`
        SELECT DISTINCT date_trunc('day', at AT TIME ZONE 'UTC') AS day
          FROM audit_logs
         WHERE "orgId" IN (${Prisma.join(orgIds)})
           AND "actorId" = ${userId}
           AND action = 'LOGIN'
           AND at >= ${since}
      `,
      allTime
        ? Promise.resolve(
            [] as {
              actorId: string | null
              action: string
              _count: { _all: number }
            }[],
          )
        : db.auditLog.groupBy({
            by: ['actorId', 'action'],
            where: wherePeriodActors,
            _count: { _all: true },
          }),
      db.membership.findMany({
        where: {
          userId,
          orgId: { in: orgIds },
          role: { not: 'CUSTOMER' },
        },
        select: { orgId: true },
      }),
      db.auditLog.findMany({
        where: {
          orgId: { in: orgIds },
          actorId: userId,
          at: { gte: chartSince },
        },
        select: { at: true, action: true },
      }),
    ])

  const byAction = new Map<string, number>()
  let workActions = 0
  let eventCount = 0
  let lastActiveAt: Date | null = null
  for (const row of actionGroups) {
    byAction.set(row.action, row._count._all)
    eventCount += row._count._all
    if (isWorkAction(row.action)) workActions += row._count._all
    if (row._max.at && (!lastActiveAt || row._max.at > lastActiveAt)) {
      lastActiveAt = row._max.at
    }
  }

  const loginDays = new Set(loginDayRows.map((row) => dayKey(row.day)))
  const activeDays = loginDays.size

  let score = 0
  let topAction: string | null = null
  let topCount = 0
  for (const [action, count] of byAction) {
    if (action === 'LOGIN') continue
    score += actionWeight(action) * count
    if (count > topCount && isWorkAction(action)) {
      topCount = count
      topAction = action
    }
  }
  score += activeDays * actionWeight('LOGIN')

  const actorScores = new Map<string, { score: number; workActions: number; activeDays: number }>()
  for (const row of actorActionGroups) {
    if (!row.actorId) continue
    let entry = actorScores.get(row.actorId)
    if (!entry) {
      entry = { score: 0, workActions: 0, activeDays: 0 }
      actorScores.set(row.actorId, entry)
    }
    if (row.action === 'LOGIN') continue
    entry.score += actionWeight(row.action) * row._count._all
    if (isWorkAction(row.action)) entry.workActions += row._count._all
  }
  // Approximate peer active days from LOGIN counts when building the median band.
  for (const row of actorActionGroups) {
    if (!row.actorId || row.action !== 'LOGIN') continue
    const entry = actorScores.get(row.actorId)
    if (!entry) continue
    const approxDays = isAllPerformanceDays(days)
      ? row._count._all
      : Math.min(days + 1, row._count._all)
    entry.activeDays = Math.max(entry.activeDays, approxDays)
    entry.score += approxDays * actionWeight('LOGIN')
  }

  // Prefer exact login days for the selected person.
  const self = actorScores.get(userId) ?? { score: 0, workActions: 0, activeDays: 0 }
  self.score = score
  self.workActions = workActions
  self.activeDays = activeDays
  actorScores.set(userId, self)

  const medianScore = medianOf(
    [...actorScores.values()].filter((r) => r.workActions > 0).map((r) => r.score),
  )
  const band = assignPerformanceBand({
    score,
    workActions,
    activeDays,
    medianScore,
  })

  const ranked = [...actorScores.entries()]
    .map(([id, row]) => ({ userId: id, ...row }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.workActions !== a.workActions) return b.workActions - a.workActions
      return a.userId.localeCompare(b.userId)
    })
  const rankIndex = ranked.findIndex((row) => row.userId === userId)
  const rank = rankIndex >= 0 ? rankIndex + 1 : ranked.length === 0 ? 0 : ranked.length
  const rankedAmong = Math.max(ranked.length, score > 0 || eventCount > 0 ? 1 : 0)

  const companyNames = [
    ...new Set([
      ...memberships.map((row) => orgNameById.get(row.orgId)).filter((n): n is string => Boolean(n)),
      ...personLogs.map((log) => orgNameById.get(log.orgId)).filter((n): n is string => Boolean(n)),
    ]),
  ].sort((a, b) => a.localeCompare(b))

  const breakdown = [...byAction.entries()]
    .map(([action, count]) => {
      const weight = actionWeight(action)
      return {
        action,
        label: USER_HISTORY_ACTION_LABEL[action] ?? action,
        count,
        weight,
        points: weight * count,
      }
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.points - a.points || b.count - a.count)

  const activity: PlatformPersonActivityItem[] = personLogs.map((log) => ({
    id: log.id,
    at: log.at,
    atLabel: formatDateTime(log.at, ctx.organization.timeZone),
    action: log.action,
    actionLabel: USER_HISTORY_ACTION_LABEL[log.action] ?? log.action,
    entity: log.entity,
    entityLabel: USER_HISTORY_ENTITY_LABEL[log.entity] ?? log.entity,
    detail: userHistoryDetail(log.after, log.before),
    orgId: log.orgId,
    orgName: orgNameById.get(log.orgId) ?? 'Company',
    ipAddress: log.ipAddress,
  }))

  const dayMap = new Map(
    emptyDayKeys(days).map((day) => [day, { day, events: 0, work: 0, logins: 0 }]),
  )
  for (const row of dailyRaw) {
    const key = dayKey(row.at)
    const bucket = dayMap.get(key)
    if (!bucket) continue
    bucket.events += 1
    if (row.action === 'LOGIN') bucket.logins += 1
    else if (isWorkAction(row.action)) bucket.work += 1
  }

  return {
    days,
    score,
    band,
    rank,
    rankedAmong,
    activeDays,
    workActions,
    eventCount,
    counts: {
      created: byAction.get('CREATE') ?? 0,
      updated: byAction.get('UPDATE') ?? 0,
      posted: byAction.get('POST') ?? 0,
      approved: byAction.get('APPROVE') ?? 0,
      logins: activeDays,
      failedLogins: byAction.get('LOGIN_FAILED') ?? 0,
    },
    topAction,
    topActionLabel: topAction
      ? (USER_HISTORY_ACTION_LABEL[topAction] ?? topAction)
      : null,
    lastActiveAt,
    lastActiveLabel: lastActiveAt
      ? formatDateTime(lastActiveAt, ctx.organization.timeZone)
      : '—',
    companyNames,
    breakdown,
    activity,
    daily: [...dayMap.values()],
  }
}

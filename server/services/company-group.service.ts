import 'server-only'

import {
  applyGroupReportView,
  MAX_SUB_COMPANIES,
  type GroupCompanyOption,
  type GroupReportView,
} from '@/lib/company-group'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export { applyGroupReportView }
export type { GroupCompanyOption, GroupReportView }

/**
 * Resolve the main company id for a group (self if already main / standalone).
 */
export async function resolveGroupRootId(orgId: string): Promise<string> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, parentOrgId: true },
  })
  if (!org) return orgId
  return org.parentOrgId ?? org.id
}

/** Main + every sub-company under it. */
export async function listGroupOrgIds(rootOrgId: string): Promise<string[]> {
  const children = await db.organization.findMany({
    where: { parentOrgId: rootOrgId },
    select: { id: true },
    orderBy: { name: 'asc' },
  })
  return [rootOrgId, ...children.map((row) => row.id)]
}

/**
 * Org ids the caller may include on the consolidated company report.
 * System owner → every company. Main OWNER/ADMIN → their group. Else → empty.
 */
export async function groupReportScope(
  ctx: OrgContext,
): Promise<{
  orgIds: string[] | 'all'
  rootOrgId: string | null
  title: string
  companies: GroupCompanyOption[]
}> {
  if (ctx.isSystemOwner) {
    const companies = await db.organization.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, parentOrgId: true, baseCurrency: true },
    })
    return {
      orgIds: 'all',
      rootOrgId: null,
      title: 'All companies',
      companies,
    }
  }

  if (ctx.role !== 'OWNER' && ctx.role !== 'ADMIN') {
    return { orgIds: [], rootOrgId: null, title: 'Company group', companies: [] }
  }

  const rootOrgId = await resolveGroupRootId(ctx.orgId)

  // Must be OWNER/ADMIN on the main company itself (not only on a sub).
  const mainMembership = await db.membership.findUnique({
    where: { orgId_userId: { orgId: rootOrgId, userId: ctx.userId } },
    select: { role: true, status: true },
  })
  const isMainAdmin =
    mainMembership?.status === 'ACTIVE' &&
    (mainMembership.role === 'OWNER' || mainMembership.role === 'ADMIN')

  if (!isMainAdmin) {
    return { orgIds: [], rootOrgId: null, title: 'Company group', companies: [] }
  }

  const companies = await db.organization.findMany({
    where: { OR: [{ id: rootOrgId }, { parentOrgId: rootOrgId }] },
    orderBy: [{ parentOrgId: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, parentOrgId: true, baseCurrency: true },
  })
  // Main first, then subs by name.
  companies.sort((a, b) => {
    if (a.id === rootOrgId) return -1
    if (b.id === rootOrgId) return 1
    return a.name.localeCompare(b.name)
  })

  const main = companies.find((row) => row.id === rootOrgId)
  return {
    orgIds: companies.map((row) => row.id),
    rootOrgId,
    title: main ? `${main.name} · group` : 'Company group',
    companies,
  }
}

/** Whether the shell / reports hub should offer the group companies report. */
export async function canViewGroupReports(ctx: OrgContext): Promise<boolean> {
  if (ctx.isSystemOwner) return true
  if (ctx.role !== 'OWNER' && ctx.role !== 'ADMIN') return false

  const rootOrgId = await resolveGroupRootId(ctx.orgId)
  const [mainMembership, childCount] = await Promise.all([
    db.membership.findUnique({
      where: { orgId_userId: { orgId: rootOrgId, userId: ctx.userId } },
      select: { role: true, status: true },
    }),
    db.organization.count({ where: { parentOrgId: rootOrgId } }),
  ])

  const isMainAdmin =
    mainMembership?.status === 'ACTIVE' &&
    (mainMembership.role === 'OWNER' || mainMembership.role === 'ADMIN')

  // Show the consolidated report once the main has at least one sub-company.
  return isMainAdmin && childCount > 0
}

export async function countSubCompanies(parentOrgId: string): Promise<number> {
  return db.organization.count({ where: { parentOrgId } })
}

export function subCompanySlotsLeft(childCount: number): number {
  return Math.max(0, MAX_SUB_COMPANIES - childCount)
}

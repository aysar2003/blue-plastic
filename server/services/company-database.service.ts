import 'server-only'

import type { Prisma } from '@prisma/client'

import { companyGroupKind } from '@/lib/company-group'
import { companyLimitStatus } from '@/lib/company-limits'
import {
  DEFAULT_FEATURE_FLAGS,
  MODULE_FLAGS,
  MODULE_FLAG_LABELS,
  parseFeatureFlags,
} from '@/lib/feature-flags'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden, notFound } from '@/server/errors'

const MEMBER_SELECT = {
  id: true,
  role: true,
  status: true,
  canConnect: true,
  permissionsOverride: true,
  createdAt: true,
  acceptedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      lastLoginAt: true,
      isSystemOwner: true,
    },
  },
} satisfies Prisma.MembershipSelect

/**
 * System owner may open any company card. Others only companies they already
 * see on Databases (membership / Connect).
 */
async function assertCanViewCompany(ctx: OrgContext, orgId: string) {
  if (ctx.isSystemOwner) return
  const membership = await db.membership.findFirst({
    where: {
      orgId,
      userId: ctx.userId,
      status: { in: ['ACTIVE', 'INVITED'] },
      role: { not: 'CUSTOMER' },
    },
    select: { id: true },
  })
  if (!membership) throw forbidden('You cannot open that company database.')
}

/** Context that points membership helpers at another company's id. */
export function asCompanyContext(ctx: OrgContext, orgId: string): OrgContext {
  return { ...ctx, orgId }
}

export async function getDetail(ctx: OrgContext, orgId: string) {
  await assertCanViewCompany(ctx, orgId)

  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      legalName: true,
      baseCurrency: true,
      timeZone: true,
      phone: true,
      email: true,
      website: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      region: true,
      postalCode: true,
      country: true,
      brandMark: true,
      parentOrgId: true,
      parent: { select: { id: true, name: true } },
      accessRestricted: true,
      rentExpiresAt: true,
      maxUsers: true,
      rentNote: true,
      featureFlags: true,
      createdAt: true,
      updatedAt: true,
      fiscalYearStartMonth: true,
      allowNegativeStock: true,
      _count: {
        select: {
          children: true,
          customers: true,
          vendors: true,
          items: true,
          salesDocuments: true,
          purchaseDocuments: true,
          projects: true,
          memberships: { where: { status: 'ACTIVE' as const, role: { not: 'CUSTOMER' as const } } },
        },
      },
      children: {
        select: { id: true, name: true, baseCurrency: true },
        orderBy: { name: 'asc' },
      },
    },
  })
  if (!organization) throw notFound('Company')

  const [members, owner] = await Promise.all([
    db.membership.findMany({
      where: { orgId, role: { not: 'CUSTOMER' } },
      select: MEMBER_SELECT,
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    }),
    db.membership.findFirst({
      where: { orgId, role: 'OWNER', status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
  ])

  const limits = companyLimitStatus(organization)
  const flags = parseFeatureFlags(organization.featureFlags ?? null)
  const modules = flags.modules ?? DEFAULT_FEATURE_FLAGS.modules
  const groupKind = companyGroupKind({
    parentOrgId: organization.parentOrgId,
    childCount: organization._count.children,
  })

  const address = [
    organization.addressLine1,
    organization.addressLine2,
    [organization.city, organization.region, organization.postalCode].filter(Boolean).join(', '),
    organization.country,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join('\n')

  return {
    id: organization.id,
    name: organization.name,
    legalName: organization.legalName,
    baseCurrency: organization.baseCurrency,
    timeZone: organization.timeZone,
    phone: organization.phone,
    email: organization.email,
    website: organization.website,
    address: address || null,
    brandMark: organization.brandMark,
    fiscalYearStartMonth: organization.fiscalYearStartMonth,
    allowNegativeStock: organization.allowNegativeStock,
    parentOrgId: organization.parentOrgId,
    parentName: organization.parent?.name ?? null,
    children: organization.children,
    childCount: organization._count.children,
    groupKind,
    accessRestricted: limits.accessRestricted,
    rentExpiresAt: limits.rentExpiresAt,
    maxUsers: limits.maxUsers,
    rentNote: limits.rentNote,
    rentExpired: limits.rentExpired,
    onTrial: limits.onTrial,
    daysLeft: limits.daysLeft,
    openBlocked: limits.openBlocked,
    activeUsers: organization._count.memberships,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    isCurrent: organization.id === ctx.orgId,
    owner: owner?.user ?? null,
    counts: {
      customers: organization._count.customers,
      vendors: organization._count.vendors,
      items: organization._count.items,
      sales: organization._count.salesDocuments,
      purchases: organization._count.purchaseDocuments,
      projects: organization._count.projects,
    },
    apps: MODULE_FLAGS.map((key) => ({
      key,
      label: MODULE_FLAG_LABELS[key].label,
      on: modules[key] !== false,
    })),
    members: members.map((row) => ({
      id: row.id,
      role: row.role,
      status: row.status,
      canConnect: row.canConnect,
      permissionsOverride: (row.permissionsOverride as string[] | null) ?? [],
      createdAt: row.createdAt.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      user: {
        id: row.user.id,
        name: row.user.name,
        email: row.user.email,
        lastLoginAt: row.user.lastLoginAt?.toISOString() ?? null,
        isSystemOwner: row.user.isSystemOwner,
      },
    })),
  }
}

export type CompanyDatabaseDetail = Awaited<ReturnType<typeof getDetail>>

/** True when this caller may invite / edit / remove users on the company card. */
export function canManageCompanyUsers(ctx: OrgContext, orgId: string) {
  if (ctx.isSystemOwner) return true
  return ctx.orgId === orgId && ctx.permissions.has('user:update')
}

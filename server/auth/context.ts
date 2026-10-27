import 'server-only'
import { cache } from 'react'
import type { Role } from '@prisma/client'

import { auth } from '@/auth'
import { sessionCompanyId } from '@/lib/company-access'
import {
  DEFAULT_FEATURE_FLAGS,
  parseFeatureFlags,
  type OrgFeatureFlags,
} from '@/lib/feature-flags'
import { db } from '@/server/db'
import { forbidden, unauthenticated } from '@/server/errors'
import { loadCompanyAccess } from './company-access'
import { type Permission, effectivePermissions } from './permissions'

/**
 * The first argument to every service function. `orgId` originates from the
 * session and nowhere else — a client-supplied organisation id is never trusted
 * (ADR-0001).
 */
export type OrgContext = {
  orgId: string
  userId: string
  role: Role
  permissions: ReadonlySet<Permission>
  /** Odoo-style Configuration switches for this organisation. */
  features: OrgFeatureFlags
  organization: {
    id: string
    name: string
    legalName: string | null
    baseCurrency: string
    fiscalYearStartMonth: number
    timeZone: string
    allowNegativeStock: boolean
    posTillLedgerMode: 'HOLD_OFF_CHART' | 'REGISTER_IN_CHART'
    /** Null when this company is the group main / standalone. */
    parentOrgId: string | null
    addressLine1: string | null
    addressLine2: string | null
    city: string | null
    region: string | null
    postalCode: string | null
    country: string | null
    phone: string | null
    email: string | null
    website: string | null
    brandMark: string | null
    hasLogo: boolean
    updatedAt: Date
  }
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  /** Sees every company database and the consolidated reports. */
  isSystemOwner: boolean
  /** May use Connect to open another company. True for the system owner too. */
  canConnect: boolean
  /**
   * When role is CUSTOMER, the customer master this login is linked to.
   * Null for staff, or for a CUSTOMER membership missing its portal link.
   */
  portalCustomerId: string | null
}

/**
 * Resolve the caller's context, re-validating the membership against the
 * database on every request. The JWT is a hint about who is asking; the
 * membership row is the authority on what they may do.
 *
 * `cache()` deduplicates this within a single render pass, so a layout, a page
 * and three server components share one lookup.
 */
const ORGANIZATION_SELECT = {
  id: true,
  name: true,
  legalName: true,
  baseCurrency: true,
  fiscalYearStartMonth: true,
  timeZone: true,
  allowNegativeStock: true,
  posTillLedgerMode: true,
  featureFlags: true,
  parentOrgId: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  region: true,
  postalCode: true,
  country: true,
  phone: true,
  email: true,
  website: true,
  brandMark: true,
  logoStorageKey: true,
  updatedAt: true,
} as const

export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const session = await auth()
  if (!session?.user?.id || !session.user.orgId) return null

  const access = await loadCompanyAccess(session.user.id)
  if (!access) return null

  const orgId = sessionCompanyId({
    isSystemOwner: access.isSystemOwner,
    maySwitch: access.maySwitch,
    sessionOrgId: session.user.orgId,
    homeOrgId: access.homeOrgId,
    memberships: access.memberships,
  })
  if (!orgId) return null

  const membership = await db.membership.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
    select: {
      role: true,
      status: true,
      version: true,
      permissionsOverride: true,
      organization: { select: ORGANIZATION_SELECT },
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  const flags = {
    isSystemOwner: access.isSystemOwner,
    canConnect: access.maySwitch,
  }

  // Revoked, suspended, or holding a token issued before a role change (ADR-0007).
  // A person who cannot switch is placed in their home company even when the
  // token still names another one, so that version belongs to a different row
  // and is not compared.
  if (membership && membership.status === 'ACTIVE') {
    const sameOrg = orgId === session.user.orgId
    if (sameOrg && membership.version !== session.user.membershipVersion) return null

    const { featureFlags, logoStorageKey, ...organization } = membership.organization
    let portalCustomerId: string | null = null
    if (membership.role === 'CUSTOMER') {
      const link = await db.customerPortalUser.findUnique({
        where: { orgId_userId: { orgId, userId: membership.user.id } },
        select: { customerId: true },
      })
      portalCustomerId = link?.customerId ?? null
    }
    return {
      orgId: membership.organization.id,
      userId: membership.user.id,
      role: membership.role,
      permissions: effectivePermissions(membership.role, membership.permissionsOverride),
      features: parseFeatureFlags(featureFlags) ?? DEFAULT_FEATURE_FLAGS,
      organization: {
        ...organization,
        hasLogo: Boolean(logoStorageKey),
      },
      user: membership.user,
      portalCustomerId,
      ...flags,
    }
  }

  // The system owner may open a company they have not been added to. They
  // enter it as owner; the books stay that company's own.
  if (!access.isSystemOwner) return null

  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: ORGANIZATION_SELECT,
  })
  if (!organization) return null

  const { featureFlags, logoStorageKey, ...orgFields } = organization
  return {
    orgId: organization.id,
    userId: access.id,
    role: 'OWNER',
    permissions: effectivePermissions('OWNER', []),
    features: parseFeatureFlags(featureFlags) ?? DEFAULT_FEATURE_FLAGS,
    organization: {
      ...orgFields,
      hasLogo: Boolean(logoStorageKey),
    },
    user: {
      id: access.id,
      name: access.name,
      email: access.email,
      image: access.image,
    },
    portalCustomerId: null,
    ...flags,
  }
})

/** Throws if signed out or lacking the permission. The default guard for every service call. */
export async function requireOrgContext(permission?: Permission): Promise<OrgContext> {
  const ctx = await getOrgContext()
  if (!ctx) throw unauthenticated()
  if (permission && !ctx.permissions.has(permission)) {
    throw forbidden(`This action requires the "${permission}" permission.`)
  }
  return ctx
}

export type PortalContext = OrgContext & { portalCustomerId: string }

/** Customer portal pages and APIs — role CUSTOMER with a linked customer. */
export async function requirePortalContext(): Promise<PortalContext> {
  const ctx = await requireOrgContext('portal:read')
  if (ctx.role !== 'CUSTOMER' || !ctx.portalCustomerId) {
    throw forbidden('This login is not linked to a customer portal.')
  }
  return ctx as PortalContext
}

export function assertPermission(ctx: OrgContext, permission: Permission): void {
  if (!ctx.permissions.has(permission)) {
    throw forbidden(`This action requires the "${permission}" permission.`)
  }
}

export function hasPermission(ctx: OrgContext, permission: Permission): boolean {
  return ctx.permissions.has(permission)
}

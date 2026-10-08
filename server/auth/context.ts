import 'server-only'
import { cache } from 'react'
import type { Role } from '@prisma/client'

import { auth } from '@/auth'
import {
  DEFAULT_FEATURE_FLAGS,
  parseFeatureFlags,
  type OrgFeatureFlags,
} from '@/lib/feature-flags'
import { db } from '@/server/db'
import { forbidden, unauthenticated } from '@/server/errors'
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
    addressLine1: string | null
    addressLine2: string | null
    city: string | null
    region: string | null
    postalCode: string | null
    country: string | null
    phone: string | null
    email: string | null
  }
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

/**
 * Resolve the caller's context, re-validating the membership against the
 * database on every request. The JWT is a hint about who is asking; the
 * membership row is the authority on what they may do.
 *
 * `cache()` deduplicates this within a single render pass, so a layout, a page
 * and three server components share one lookup.
 */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const session = await auth()
  if (!session?.user?.id || !session.user.orgId) return null

  const membership = await db.membership.findUnique({
    where: { orgId_userId: { orgId: session.user.orgId, userId: session.user.id } },
    select: {
      role: true,
      status: true,
      version: true,
      permissionsOverride: true,
      organization: {
        select: {
          id: true,
          name: true,
          legalName: true,
          baseCurrency: true,
          fiscalYearStartMonth: true,
          timeZone: true,
          allowNegativeStock: true,
          featureFlags: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          region: true,
          postalCode: true,
          country: true,
          phone: true,
          email: true,
        },
      },
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  // Revoked, suspended, or holding a token issued before a role change (ADR-0007).
  if (!membership) return null
  if (membership.status !== 'ACTIVE') return null
  if (membership.version !== session.user.membershipVersion) return null

  const { featureFlags, ...organization } = membership.organization

  return {
    orgId: membership.organization.id,
    userId: membership.user.id,
    role: membership.role,
    permissions: effectivePermissions(membership.role, membership.permissionsOverride),
    features: parseFeatureFlags(featureFlags) ?? DEFAULT_FEATURE_FLAGS,
    organization,
    user: membership.user,
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

export function assertPermission(ctx: OrgContext, permission: Permission): void {
  if (!ctx.permissions.has(permission)) {
    throw forbidden(`This action requires the "${permission}" permission.`)
  }
}

export function hasPermission(ctx: OrgContext, permission: Permission): boolean {
  return ctx.permissions.has(permission)
}

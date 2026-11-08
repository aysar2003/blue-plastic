import 'server-only'

import type { Prisma } from '@prisma/client'

import { getPack, resolveFeatureFlagsFromPack, type PackInstallOptions } from '@/lib/packs'
import { parseFeatureFlags } from '@/lib/feature-flags'
import { seedChartOfAccounts } from '@/server/accounting/chart-of-accounts'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden, notFound, validation } from '@/server/errors'

export type InstallPackResult = {
  orgId: string
  packId: string
  packLabel: string
  verticalStatus: 'ready' | 'planned'
  chartSeeded: boolean
  modulesOn: string[]
}

/**
 * Apply an industry pack to a company: feature flags + optional CoA seed.
 * System owner may replace grants; company admins clamp to existing grants.
 */
export async function installPack(
  ctx: OrgContext,
  packId: string,
  options: PackInstallOptions = {},
): Promise<InstallPackResult> {
  const pack = getPack(packId)
  if (!pack) throw validation('Unknown industry pack.')

  const replaceGrants = options.replaceGrants ?? ctx.isSystemOwner
  // System owner always may. Company OWNER/ADMIN may replace grants only for
  // their own org (onboarding wizard / Settings re-run).
  if (
    replaceGrants &&
    !ctx.isSystemOwner &&
    ctx.role !== 'OWNER' &&
    ctx.role !== 'ADMIN'
  ) {
    throw forbidden('Only an owner or admin can replace app grants via a pack.')
  }

  const seedChart = options.seedChart ?? pack.seedChartDefault
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const before = await tx.organization.findUnique({
      where: { id: ctx.orgId },
      select: { id: true, featureFlags: true, installedPackId: true },
    })
    if (!before) throw notFound('Organisation')

    const previous = parseFeatureFlags(before.featureFlags)
    const flags = resolveFeatureFlagsFromPack(pack, previous, { replaceGrants, seedChart })

    const after = await tx.organization.update({
      where: { id: ctx.orgId },
      data: {
        featureFlags: flags as unknown as Prisma.InputJsonValue,
        installedPackId: pack.id,
      },
      select: { id: true, installedPackId: true, featureFlags: true },
    })

    let chartSeeded = false
    if (seedChart) {
      const result = await seedChartOfAccounts(tx, ctx.orgId)
      chartSeeded = result.created > 0
    }

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Organization',
        entityId: ctx.orgId,
        action: 'UPDATE',
        before: {
          installedPackId: before.installedPackId,
          modules: previous.modules,
        },
        after: {
          installedPackId: after.installedPackId,
          packId: pack.id,
          modules: flags.modules,
          chartSeeded,
        },
      },
      meta,
    )

    return {
      orgId: after.id,
      packId: pack.id,
      packLabel: pack.label,
      verticalStatus: pack.verticalStatus,
      chartSeeded,
      modulesOn: Object.entries(flags.modules)
        .filter(([, on]) => on)
        .map(([key]) => key)
        .sort(),
    }
  })
}

/** Install a pack onto another company (Databases console — system owner). */
export async function installPackForOrg(
  ctx: OrgContext,
  targetOrgId: string,
  packId: string,
  options: PackInstallOptions = {},
): Promise<InstallPackResult> {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can install a pack on another company.')
  }

  const target = await db.organization.findUnique({
    where: { id: targetOrgId },
    select: { id: true },
  })
  if (!target) throw notFound('Organisation')

  const scoped: OrgContext = {
    ...ctx,
    orgId: target.id,
  }

  return installPack(scoped, packId, {
    ...options,
    replaceGrants: true,
  })
}

export async function getInstalledPack(orgId: string) {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { installedPackId: true },
  })
  if (!org?.installedPackId) return null
  return getPack(org.installedPackId)
}

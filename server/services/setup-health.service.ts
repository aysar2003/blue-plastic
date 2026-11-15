import 'server-only'

import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { localizationPackById } from '@/lib/localization/packs'
import { parseFeatureFlags } from '@/lib/feature-flags'
import { getPack } from '@/lib/packs'

export type SetupHealth = {
  installedPackId: string | null
  installedPackLabel: string | null
  localizationPackId: string | null
  country: string | null
  localizationReady: boolean
  enableTax: boolean
  modulesOn: number
  modulesGranted: number
  itemsTotal: number
  itemsMissingSku: number
  stockMissingReorder: number
  customersTotal: number
  customersMissingBillingCountry: number
  orgCountryMissing: boolean
}

/**
 * One snapshot for Settings → Setup: apps weight, localization, master-data gaps.
 * Does not change data — only reports what staff should finish.
 */
export async function loadSetupHealth(ctx: OrgContext): Promise<SetupHealth> {
  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: {
      installedPackId: true,
      localizationPackId: true,
      country: true,
      featureFlags: true,
    },
  })
  const flags = parseFeatureFlags(org?.featureFlags)
  const modulesOn = Object.values(flags.modules).filter(Boolean).length
  const modulesGranted = Object.values(flags.grantedModules).filter(Boolean).length

  const [
    itemsTotal,
    itemsMissingSku,
    stockMissingReorder,
    customersTotal,
    customersMissingBillingCountry,
  ] = await Promise.all([
    db.item.count({ where: { orgId: ctx.orgId, deletedAt: null, isActive: true } }),
    db.item.count({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        isActive: true,
        OR: [{ sku: null }, { sku: '' }],
      },
    }),
    db.item.count({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        isActive: true,
        type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
        reorderPoint: null,
      },
    }),
    db.customer.count({ where: { orgId: ctx.orgId, isActive: true } }),
    db.customer.count({
      where: {
        orgId: ctx.orgId,
        isActive: true,
        OR: [{ billingCountry: null }, { billingCountry: '' }],
      },
    }),
  ])

  const pack = org?.installedPackId ? getPack(org.installedPackId) : null
  const localizationPackId = org?.localizationPackId ?? null

  return {
    installedPackId: org?.installedPackId ?? null,
    installedPackLabel: pack?.label ?? null,
    localizationPackId,
    country: org?.country ?? null,
    localizationReady: Boolean(localizationPackById(localizationPackId)),
    enableTax: flags.enableTax,
    modulesOn,
    modulesGranted,
    itemsTotal,
    itemsMissingSku,
    stockMissingReorder,
    customersTotal,
    customersMissingBillingCountry,
    orgCountryMissing: !org?.country?.trim(),
  }
}

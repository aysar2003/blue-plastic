import 'server-only'

import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { localizationPackById } from '@/lib/localization/packs'
import { parseFeatureFlags } from '@/lib/feature-flags'
import { getPack } from '@/lib/packs'
import {
  SETUP_HEALTH_GAP_HEADERS,
  type SetupHealthGapRow,
} from '@/lib/setup-heal'
import { toCsv } from '@/server/reports/csv'

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
  itemsMissingTax: number
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
    itemsMissingTax,
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
    db.item.count({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        isActive: true,
        OR: [{ salesTaxCodeId: null }, { purchaseTaxCodeId: null }],
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
    itemsMissingTax,
    customersTotal,
    customersMissingBillingCountry,
    orgCountryMissing: !org?.country?.trim(),
  }
}

/** Remaining gaps as rows for CSV export. */
export async function listSetupHealthGaps(ctx: OrgContext): Promise<SetupHealthGapRow[]> {
  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { name: true, country: true },
  })
  const [missingSku, missingReorder, missingTax, missingCountry] = await Promise.all([
    db.item.findMany({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        isActive: true,
        OR: [{ sku: null }, { sku: '' }],
      },
      select: { id: true, name: true, sku: true },
      orderBy: { name: 'asc' },
      take: 5000,
    }),
    db.item.findMany({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        isActive: true,
        type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
        reorderPoint: null,
      },
      select: { id: true, name: true, sku: true },
      orderBy: { name: 'asc' },
      take: 5000,
    }),
    db.item.findMany({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        isActive: true,
        OR: [{ salesTaxCodeId: null }, { purchaseTaxCodeId: null }],
      },
      select: { id: true, name: true, sku: true, salesTaxCodeId: true, purchaseTaxCodeId: true },
      orderBy: { name: 'asc' },
      take: 5000,
    }),
    db.customer.findMany({
      where: {
        orgId: ctx.orgId,
        isActive: true,
        OR: [{ billingCountry: null }, { billingCountry: '' }],
      },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 5000,
    }),
  ])

  const gaps: SetupHealthGapRow[] = []
  if (!org?.country?.trim()) {
    gaps.push({
      kind: 'org_missing_country',
      name: org?.name ?? 'Organisation',
      detail: 'Set country on Settings → Organisation, or heal from the localisation pack',
    })
  }
  for (const item of missingSku) {
    gaps.push({
      kind: 'item_missing_sku',
      name: item.name,
      sku: item.sku,
      id: item.id,
      detail: 'Active item has no SKU',
    })
  }
  for (const item of missingReorder) {
    gaps.push({
      kind: 'stock_missing_reorder',
      name: item.name,
      sku: item.sku,
      id: item.id,
      detail: 'Stock item has no reorder point',
    })
  }
  for (const item of missingTax) {
    const parts = [
      item.salesTaxCodeId ? null : 'sales tax',
      item.purchaseTaxCodeId ? null : 'purchase tax',
    ].filter(Boolean)
    gaps.push({
      kind: 'item_missing_tax',
      name: item.name,
      sku: item.sku,
      id: item.id,
      detail: `Missing ${parts.join(' and ')}`,
    })
  }
  for (const customer of missingCountry) {
    gaps.push({
      kind: 'customer_missing_country',
      name: customer.displayName,
      id: customer.id,
      detail: 'Active customer has no billing country',
    })
  }
  return gaps
}

export function setupHealthGapsCsv(gaps: SetupHealthGapRow[]): string {
  return toCsv([[...SETUP_HEALTH_GAP_HEADERS], ...gaps.map((row) => [
    row.kind,
    row.name,
    row.sku ?? '',
    row.id ?? '',
    row.detail,
  ])])
}

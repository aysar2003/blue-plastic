import 'server-only'

import { localizationPackById } from '@/lib/localization/packs'
import { skuFromName } from '@/lib/sku'
import { requestMeta, writeAudit } from '@/server/audit'
import { can } from '@/server/auth/permissions'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden, notFound, validation } from '@/server/errors'
import * as itemService from '@/server/services/item.service'

function assertAdmin(ctx: OrgContext) {
  if (!can(ctx.role, 'org:update') && !ctx.isSystemOwner) {
    throw forbidden('Only an admin can heal master data.')
  }
}

/** Fill blank SKUs from item names (same rules as Excel import). */
export async function healMissingItemSkus(ctx: OrgContext) {
  assertAdmin(ctx)
  const meta = await requestMeta()

  const [missing, withSku] = await Promise.all([
    db.item.findMany({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        isActive: true,
        OR: [{ sku: null }, { sku: '' }],
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 5000,
    }),
    db.item.findMany({
      where: {
        orgId: ctx.orgId,
        deletedAt: null,
        sku: { not: null },
      },
      select: { sku: true },
    }),
  ])

  const taken = new Set(
    withSku.map((row) => row.sku!.trim().toLowerCase()).filter(Boolean),
  )

  let healed = 0
  await db.$transaction(async (tx) => {
    for (const item of missing) {
      const sku = skuFromName(item.name, taken)
      taken.add(sku.toLowerCase())
      await tx.item.update({ where: { id: item.id }, data: { sku } })
      healed += 1
    }
    if (healed > 0) {
      await writeAudit(
        tx,
        ctx,
        {
          entity: 'Item',
          entityId: ctx.orgId,
          action: 'UPDATE',
          after: { heal: 'missing_skus', count: healed },
        },
        meta,
      )
    }
  })

  return { healed, scanned: missing.length }
}

/** Set reorderPoint = 1 on stock items that have none. */
export async function healMissingReorderPoints(ctx: OrgContext, defaultRaw = '1') {
  assertAdmin(ctx)
  const missing = await db.item.findMany({
    where: {
      orgId: ctx.orgId,
      deletedAt: null,
      isActive: true,
      type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] },
      reorderPoint: null,
    },
    select: { id: true },
    take: 5000,
  })

  let healed = 0
  for (const item of missing) {
    await itemService.setReorderPoint(ctx, item.id, defaultRaw)
    healed += 1
  }
  return { healed, scanned: missing.length, defaultValue: defaultRaw }
}

/** Copy org country onto customers missing billingCountry. */
export async function healCustomerCountriesFromOrg(ctx: OrgContext) {
  assertAdmin(ctx)
  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { country: true },
  })
  if (!org) throw notFound('Organisation')
  const country = org.country?.trim().toUpperCase() || null
  if (!country) {
    throw validation('Set the organisation country first (or heal it from the localization pack).')
  }

  const meta = await requestMeta()
  const result = await db.$transaction(async (tx) => {
    const updated = await tx.customer.updateMany({
      where: {
        orgId: ctx.orgId,
        isActive: true,
        OR: [{ billingCountry: null }, { billingCountry: '' }],
      },
      data: { billingCountry: country },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Customer',
        entityId: ctx.orgId,
        action: 'UPDATE',
        after: { heal: 'billing_country', country, count: updated.count },
      },
      meta,
    )
    return updated.count
  })

  return { healed: result, country }
}

/** When pack is set and org country is blank, copy pack.country. */
export async function healOrgCountryFromPack(ctx: OrgContext) {
  assertAdmin(ctx)
  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { country: true, localizationPackId: true },
  })
  if (!org) throw notFound('Organisation')
  if (org.country?.trim()) {
    return { applied: false as const, country: org.country }
  }
  const pack = localizationPackById(org.localizationPackId)
  if (!pack) {
    throw validation('Set a localization pack before healing country from pack.')
  }
  const meta = await requestMeta()
  await db.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: ctx.orgId },
      data: { country: pack.country },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Organization',
        entityId: ctx.orgId,
        action: 'UPDATE',
        after: { heal: 'country_from_pack', country: pack.country, packId: pack.id },
      },
      meta,
    )
  })
  return { applied: true as const, country: pack.country, packId: pack.id }
}

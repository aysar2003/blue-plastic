import 'server-only'

import { parseFeatureFlags, type OrgFeatureFlags } from '@/lib/feature-flags'
import type {
  OrganizationAccountingInput,
  OrganizationFeaturesInput,
  OrganizationUpdateInput,
} from '@/lib/validation/organization'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition } from '@/server/errors'

const PROFILE_SELECT = {
  id: true,
  name: true,
  legalName: true,
  baseCurrency: true,
  fiscalYearStartMonth: true,
  taxRegistrationNumber: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  region: true,
  postalCode: true,
  country: true,
  phone: true,
  email: true,
  website: true,
  timeZone: true,
  createdAt: true,
} as const

export async function get(ctx: OrgContext) {
  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: PROFILE_SELECT,
  })
  if (!org) throw notFound('Organisation')
  return org
}

export async function update(ctx: OrgContext, input: OrganizationUpdateInput) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const before = await tx.organization.findUnique({
      where: { id: ctx.orgId },
      select: PROFILE_SELECT,
    })
    if (!before) throw notFound('Organisation')

    const after = await tx.organization.update({
      where: { id: ctx.orgId },
      data: input,
      select: PROFILE_SELECT,
    })

    await writeAudit(
      tx,
      ctx,
      { entity: 'Organization', entityId: ctx.orgId, action: 'UPDATE', before, after },
      meta,
    )
    return after
  })
}

/**
 * Base currency and fiscal year define how every future journal is recorded and
 * reported. From Phase 2 onward, changing them once a journal exists would
 * silently restate history, so the guard lives here from the start — the check is
 * a no-op today and becomes load-bearing the moment the ledger has rows.
 */
export async function updateAccountingSettings(
  ctx: OrgContext,
  input: OrganizationAccountingInput,
) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const before = await tx.organization.findUnique({
      where: { id: ctx.orgId },
      select: PROFILE_SELECT,
    })
    if (!before) throw notFound('Organisation')

    const changing =
      before.baseCurrency !== input.baseCurrency ||
      before.fiscalYearStartMonth !== input.fiscalYearStartMonth

    if (changing && (await hasLedgerActivity(ctx.orgId))) {
      throw precondition(
        'The base currency and fiscal year cannot be changed once transactions have been recorded.',
      )
    }

    const after = await tx.organization.update({
      where: { id: ctx.orgId },
      data: input,
      select: PROFILE_SELECT,
    })

    await writeAudit(
      tx,
      ctx,
      { entity: 'Organization', entityId: ctx.orgId, action: 'UPDATE', before, after },
      meta,
    )
    return after
  })
}

/**
 * True once anything has been posted to the ledger. The journal tables arrive in
 * Phase 2; until then there is by definition no activity to protect.
 */
export async function getFeatureFlags(ctx: OrgContext): Promise<OrgFeatureFlags> {
  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { featureFlags: true },
  })
  if (!org) throw notFound('Organisation')
  return parseFeatureFlags(org.featureFlags)
}

export async function updateFeatureFlags(ctx: OrgContext, input: OrganizationFeaturesInput) {
  const meta = await requestMeta()
  const flags: OrgFeatureFlags = {
    allowJournalDelete: input.allowJournalDelete,
    allowContactDelete: input.allowContactDelete,
    allowDocumentDelete: input.allowDocumentDelete,
    showCreatorBrand: input.showCreatorBrand,
    modules: {
      sales: input.moduleSales,
      purchases: input.modulePurchases,
      banking: input.moduleBanking,
      inventory: input.moduleInventory,
      pos: input.modulePos,
      accounting: input.moduleAccounting,
      reports: input.moduleReports,
    },
  }

  return db.$transaction(async (tx) => {
    const before = await tx.organization.findUnique({
      where: { id: ctx.orgId },
      select: { featureFlags: true },
    })
    if (!before) throw notFound('Organisation')

    const after = await tx.organization.update({
      where: { id: ctx.orgId },
      data: { featureFlags: flags },
      select: { featureFlags: true },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Organization',
        entityId: ctx.orgId,
        action: 'UPDATE',
        before: { featureFlags: before.featureFlags },
        after: { featureFlags: after.featureFlags },
      },
      meta,
    )
    return parseFeatureFlags(after.featureFlags)
  })
}

async function hasLedgerActivity(orgId: string): Promise<boolean> {
  const [row] = await db.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_name = 'journals'
    ) AS exists
  `
  if (!row?.exists) return false

  const [count] = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n FROM journals WHERE "orgId" = ${orgId} LIMIT 1
  `
  return (count?.n ?? 0n) > 0n
}

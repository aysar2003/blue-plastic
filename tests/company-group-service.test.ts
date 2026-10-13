import { afterAll, describe, expect, it } from 'vitest'

import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'
import { MAX_SUB_COMPANIES } from '@/lib/company-group'
import type { OrgContext } from '@/server/auth/context'
import { permissionsFor } from '@/server/auth/permissions'
import { db } from '@/server/db'
import { AppError } from '@/server/errors'
import {
  attachSubCompany,
  createCompany,
  deleteCompany,
} from '@/server/services/company.service'
import {
  canViewGroupReports,
  groupReportScope,
  listGroupOrgIds,
} from '@/server/services/company-group.service'

/** Needs a real database; skipped when DATABASE_URL is not set. */
const suite = process.env.DATABASE_URL ? describe : describe.skip

const ALL_APPS = {
  moduleSales: true,
  modulePurchases: true,
  moduleBanking: true,
  moduleInventory: true,
  modulePos: true,
  moduleAccounting: true,
  moduleReports: true,
}

const stamp = `grp-${Date.now().toString(36)}`
const createdIds: string[] = []

async function ownerCtx(): Promise<OrgContext | null> {
  const owner = await db.user.findFirst({
    where: { isSystemOwner: true },
    select: { id: true, name: true, email: true, image: true },
  })
  if (!owner) return null

  const organization = await db.organization.findFirst({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      legalName: true,
      baseCurrency: true,
      fiscalYearStartMonth: true,
      timeZone: true,
      allowNegativeStock: true,
      posTillLedgerMode: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      region: true,
      postalCode: true,
      country: true,
      phone: true,
      email: true,
      brandMark: true,
      logoStorageKey: true,
      updatedAt: true,
    },
  })
  if (!organization) return null

  const { logoStorageKey, ...orgFields } = organization
  return {
    orgId: organization.id,
    userId: owner.id,
    role: 'OWNER',
    permissions: permissionsFor('OWNER'),
    isSystemOwner: true,
    canConnect: true,
    features: DEFAULT_FEATURE_FLAGS,
    organization: { ...orgFields, hasLogo: Boolean(logoStorageKey) },
    user: owner,
  }
}

suite('company group service', () => {
  afterAll(async () => {
    for (const id of [...createdIds].reverse()) {
      try {
        await db.organization.update({ where: { id }, data: { parentOrgId: null } })
      } catch {
        /* ignore */
      }
    }
    for (const id of [...createdIds].reverse()) {
      try {
        await db.organization.delete({ where: { id } })
      } catch {
        /* ignore */
      }
    }
  })

  it(
    'creates a main with two subs, blocks a third, and scopes group reports',
    async () => {
      const ctx = await ownerCtx()
      if (!ctx) return

      const main = await createCompany(ctx, {
        name: `${stamp}-MAIN`,
        baseCurrency: 'USD',
        fiscalYearStartMonth: 1,
        seedChart: false, ...ALL_APPS,
        parentOrgId: null,
      })
      createdIds.push(main.id)

      const sub1 = await createCompany(ctx, {
        name: `${stamp}-SUB-A`,
        baseCurrency: 'USD',
        fiscalYearStartMonth: 1,
        seedChart: false, ...ALL_APPS,
        parentOrgId: main.id,
      })
      createdIds.push(sub1.id)

      const sub2 = await createCompany(ctx, {
        name: `${stamp}-SUB-B`,
        baseCurrency: 'USD',
        fiscalYearStartMonth: 1,
        seedChart: false, ...ALL_APPS,
        parentOrgId: main.id,
      })
      createdIds.push(sub2.id)

      expect(sub1.parentOrgId).toBe(main.id)
      expect(sub2.parentOrgId).toBe(main.id)

      const groupIds = await listGroupOrgIds(main.id)
      expect(groupIds).toEqual(expect.arrayContaining([main.id, sub1.id, sub2.id]))
      expect(groupIds).toHaveLength(1 + MAX_SUB_COMPANIES)

      await expect(
        createCompany(ctx, {
          name: `${stamp}-SUB-C`,
          baseCurrency: 'USD',
          fiscalYearStartMonth: 1,
          seedChart: false, ...ALL_APPS,
          parentOrgId: main.id,
        }),
      ).rejects.toBeInstanceOf(AppError)

      const mainCtx: OrgContext = {
        ...ctx,
        orgId: main.id,
        isSystemOwner: false,
        organization: { ...ctx.organization, id: main.id, name: main.name },
      }
      expect(await canViewGroupReports(mainCtx)).toBe(true)
      const scope = await groupReportScope(mainCtx)
      expect(scope.orgIds).toEqual(expect.arrayContaining([main.id, sub1.id, sub2.id]))
      expect(scope.companies.map((row) => row.id)).toEqual(
        expect.arrayContaining([main.id, sub1.id, sub2.id]),
      )
      expect(scope.companies[0]?.id).toBe(main.id)

      // Cleanup via service (children first).
      for (const org of [sub2, sub1, main]) {
        await deleteCompany(ctx, { orgId: org.id, confirmName: org.name })
        const idx = createdIds.indexOf(org.id)
        if (idx >= 0) createdIds.splice(idx, 1)
      }
    },
    120_000,
  )

  it('attaches a standalone under a main', async () => {
    const ctx = await ownerCtx()
    if (!ctx) return

    const main = await createCompany(ctx, {
      name: `${stamp}-ATTACH-MAIN`,
      baseCurrency: 'USD',
      fiscalYearStartMonth: 1,
      seedChart: false, ...ALL_APPS,
    })
    createdIds.push(main.id)

    const standalone = await createCompany(ctx, {
      name: `${stamp}-ATTACH-CHILD`,
      baseCurrency: 'USD',
      fiscalYearStartMonth: 1,
      seedChart: false, ...ALL_APPS,
    })
    createdIds.push(standalone.id)

    const attached = await attachSubCompany(ctx, {
      orgId: standalone.id,
      parentOrgId: main.id,
    })
    expect(attached.parentOrgId).toBe(main.id)

    const row = await db.organization.findUnique({
      where: { id: standalone.id },
      select: { parentOrgId: true },
    })
    expect(row?.parentOrgId).toBe(main.id)

    await deleteCompany(ctx, { orgId: standalone.id, confirmName: standalone.name })
    await deleteCompany(ctx, { orgId: main.id, confirmName: main.name })
    createdIds.length = 0
  }, 120_000)
})

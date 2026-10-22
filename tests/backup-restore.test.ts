import { afterAll, describe, expect, it } from 'vitest'

import { seedChartOfAccounts } from '@/server/accounting/chart-of-accounts'
import type { OrgContext } from '@/server/auth/context'
import { permissionsFor } from '@/server/auth/permissions'
import { db } from '@/server/db'
import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'
import { wipeCompanyBooks } from '@/server/company-wipe'
import { companyBackup } from '@/server/services/backup.service'
import { replaceCompanyFromBackup } from '@/server/services/backup-restore.service'
import { createDefaultSequences } from '@/server/sequences'

/**
 * Live restore: create a throwaway company, backup, add a row after the backup,
 * restore, prove the post-backup row is gone and the earlier row returns.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL)
const suite = hasDatabase ? describe : describe.skip

const stamp = Date.now().toString(36)
const orgName = `Restore Probe ${stamp}`
let orgId: string | null = null

async function cleanup() {
  if (!orgId) return
  const id = orgId
  orgId = null
  try {
    await db.$transaction(async (tx) => {
      await wipeCompanyBooks(tx, id)
      await tx.organization.delete({ where: { id } })
    })
  } catch {
    // Already removed by a successful restore mid-test, or wipe already ran.
  }
}

afterAll(async () => {
  await cleanup()
})

suite('company backup restore', () => {
  it(
    'replaces live books with an earlier backup (post-backup data is discarded)',
    async () => {
      const owner = await db.user.findFirst({
        where: { isSystemOwner: true },
        select: { id: true, name: true, email: true, image: true },
      })
      if (!owner) throw new Error('No system owner in the database — cannot test restore.')

      const organization = await db.organization.create({
        data: {
          name: orgName,
          baseCurrency: 'USD',
          fiscalYearStartMonth: 1,
          timeZone: 'UTC',
        },
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
      orgId = organization.id

      await db.membership.create({
        data: {
          orgId: organization.id,
          userId: owner.id,
          role: 'OWNER',
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      })

      await db.$transaction(async (tx) => {
        await createDefaultSequences(tx, organization.id)
        await seedChartOfAccounts(tx, organization.id)
      })

      const keep = await db.customer.create({
        data: {
          orgId: organization.id,
          displayName: `KEEP-${stamp}`,
          isActive: true,
        },
        select: { id: true, displayName: true },
      })

      const { logoStorageKey, ...orgFields } = organization
      const ctx: OrgContext = {
        orgId: organization.id,
        userId: owner.id,
        role: 'OWNER',
        permissions: permissionsFor('OWNER'),
        isSystemOwner: true,
        canConnect: true,
        portalCustomerId: null,
        features: DEFAULT_FEATURE_FLAGS,
        organization: { ...orgFields, hasLogo: Boolean(logoStorageKey) },
        user: owner,
      }

      const backup = await companyBackup(ctx)
      expect(backup.customers?.length).toBeGreaterThanOrEqual(1)

      await db.customer.create({
        data: {
          orgId: organization.id,
          displayName: `AFTER-${stamp}`,
          isActive: true,
        },
      })

      const beforeRestore = await db.customer.count({ where: { orgId: organization.id } })
      expect(beforeRestore).toBeGreaterThanOrEqual(2)

      const result = await replaceCompanyFromBackup(ctx, {
        targetOrgId: organization.id,
        confirmName: orgName,
        backup,
      })

      expect(result.orgId).toBe(organization.id)
      expect(result.name).toBe(orgName)

      const names = (
        await db.customer.findMany({
          where: { orgId: organization.id },
          select: { displayName: true },
        })
      ).map((row) => row.displayName)

      expect(names).toContain(keep.displayName)
      expect(names).not.toContain(`AFTER-${stamp}`)

      const membership = await db.membership.findUnique({
        where: { orgId_userId: { orgId: organization.id, userId: owner.id } },
        select: { role: true, status: true },
      })
      expect(membership?.status).toBe('ACTIVE')
      expect(membership?.role).toBe('OWNER')

      const accounts = await db.ledgerAccount.count({ where: { orgId: organization.id } })
      expect(accounts).toBeGreaterThan(10)

      await cleanup()
    },
    180_000,
  )

  it('refuses restore when the confirmation name does not match', async () => {
    const owner = await db.user.findFirst({
      where: { isSystemOwner: true },
      select: { id: true, name: true, email: true, image: true },
    })
    if (!owner) return

    const organization = await db.organization.create({
      data: { name: `Restore Deny ${stamp}`, baseCurrency: 'USD' },
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
    orgId = organization.id

    await db.membership.create({
      data: {
        orgId: organization.id,
        userId: owner.id,
        role: 'OWNER',
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    })

    const { logoStorageKey, ...orgFields } = organization
    const ctx: OrgContext = {
      orgId: organization.id,
      userId: owner.id,
      role: 'OWNER',
      permissions: permissionsFor('OWNER'),
      isSystemOwner: true,
      canConnect: true,
      portalCustomerId: null,
      features: DEFAULT_FEATURE_FLAGS,
      organization: { ...orgFields, hasLogo: Boolean(logoStorageKey) },
      user: owner,
    }

    const backup = await companyBackup(ctx)

    await expect(
      replaceCompanyFromBackup(ctx, {
        targetOrgId: organization.id,
        confirmName: 'wrong name',
        backup,
      }),
    ).rejects.toThrow(/exactly/i)

    await cleanup()
  })
})

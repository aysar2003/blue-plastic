import { afterAll, describe, expect, it } from 'vitest'

import { env } from '@/lib/env'
import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'
import { openPortalInvite } from '@/lib/portal-invite-token'
import { portalLoginPath } from '@/lib/portal-login'
import { invitePortalUserSchema, parseInvitePortalUserInput } from '@/lib/validation/portal'
import type { OrgContext } from '@/server/auth/context'
import { permissionsFor } from '@/server/auth/permissions'
import { db } from '@/server/db'
import * as portalService from '@/server/services/portal.service'

describe('invitePortalUserSchema', () => {
  const base = {
    customerId: 'cust_1',
    name: 'Amina',
    email: 'amina@test.invalid',
  }

  it('defaults to password mode and requires a temporary password', () => {
    const ok = parseInvitePortalUserInput({
      ...base,
      temporaryPassword: 'secret1',
    })
    expect(ok.success).toBe(true)
    if (ok.success) {
      expect(ok.data.inviteMode).toBe('password')
      expect(ok.data.temporaryPassword).toBe('secret1')
    }

    const missing = parseInvitePortalUserInput(base)
    expect(missing.success).toBe(false)
  })

  it('allows link mode without a password', () => {
    const ok = invitePortalUserSchema.safeParse({
      ...base,
      inviteMode: 'link',
    })
    expect(ok.success).toBe(true)
    if (ok.success) {
      expect(ok.data.inviteMode).toBe('link')
    }
  })

  it('rejects short passwords in password mode', () => {
    const bad = invitePortalUserSchema.safeParse({
      ...base,
      inviteMode: 'password',
      temporaryPassword: 'ab',
    })
    expect(bad.success).toBe(false)
  })
})

describe('portalLoginPath', () => {
  it('builds the branded company login URL', () => {
    expect(portalLoginPath('org_abc')).toBe('/portal/login?company=org_abc')
  })
})

/** Needs a real database; services open their own transactions. */
const live = process.env.DATABASE_URL ? describe : describe.skip

const stamp = `portal-inv-${Date.now().toString(36)}`
const cleanup: { userIds: string[]; orgId?: string; customerIds: string[] } = {
  userIds: [],
  customerIds: [],
}

live('portal invite dual-mode (live db)', () => {
  afterAll(async () => {
    for (const id of cleanup.customerIds) {
      await db.customerPortalUser.deleteMany({ where: { customerId: id } }).catch(() => undefined)
      await db.customer.delete({ where: { id } }).catch(() => undefined)
    }
    for (const id of cleanup.userIds) {
      await db.membership.deleteMany({ where: { userId: id } }).catch(() => undefined)
      await db.user.delete({ where: { id } }).catch(() => undefined)
    }
    if (cleanup.orgId) {
      await db.organization.delete({ where: { id: cleanup.orgId } }).catch(() => undefined)
    }
  })

  it('password mode creates ACTIVE login; link mode creates INVITED + accept token', async () => {
    const organization = await db.organization.create({
      data: {
        name: `Portal Invite ${stamp}`,
        baseCurrency: 'USD',
        featureFlags: { enableCustomerPortal: true },
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
    cleanup.orgId = organization.id

    const staff = await db.user.create({
      data: { email: `staff-${stamp}@test.invalid`, name: 'Staff' },
      select: { id: true, name: true, email: true, image: true },
    })
    cleanup.userIds.push(staff.id)
    await db.membership.create({
      data: { orgId: organization.id, userId: staff.id, role: 'OWNER', status: 'ACTIVE' },
    })

    const customerPassword = await db.customer.create({
      data: { orgId: organization.id, displayName: `Cust P ${stamp}`, isActive: true },
      select: { id: true },
    })
    const customerLink = await db.customer.create({
      data: { orgId: organization.id, displayName: `Cust L ${stamp}`, isActive: true },
      select: { id: true },
    })
    cleanup.customerIds.push(customerPassword.id, customerLink.id)

    const { logoStorageKey, ...orgFields } = organization
    const realCtx: OrgContext = {
      orgId: organization.id,
      userId: staff.id,
      role: 'OWNER',
      permissions: permissionsFor('OWNER'),
      isSystemOwner: false,
      canConnect: false,
      portalCustomerId: null,
      features: { ...DEFAULT_FEATURE_FLAGS, enableCustomerPortal: true },
      organization: { ...orgFields, hasLogo: Boolean(logoStorageKey) },
      user: staff,
    }

    const passwordInvite = await portalService.invitePortalUser(realCtx, {
      customerId: customerPassword.id,
      name: 'Password Guest',
      email: `pwd-${stamp}@test.invalid`,
      inviteMode: 'password',
      temporaryPassword: 'temp-pass-1',
    })
    cleanup.userIds.push(passwordInvite.userId)

    expect(passwordInvite.inviteMode).toBe('password')
    expect(passwordInvite.inviteToken).toBeUndefined()
    const pwdMembership = await db.membership.findUniqueOrThrow({
      where: { id: passwordInvite.membershipId },
      select: { status: true, acceptedAt: true },
    })
    expect(pwdMembership.status).toBe('ACTIVE')
    expect(pwdMembership.acceptedAt).not.toBeNull()
    expect(portalLoginPath(passwordInvite.orgId)).toContain(`company=${passwordInvite.orgId}`)

    const linkInvite = await portalService.invitePortalUser(realCtx, {
      customerId: customerLink.id,
      name: 'Link Guest',
      email: `link-${stamp}@test.invalid`,
      inviteMode: 'link',
    })
    cleanup.userIds.push(linkInvite.userId)

    expect(linkInvite.inviteMode).toBe('link')
    expect(linkInvite.inviteToken).toBeTruthy()
    const linkMembership = await db.membership.findUniqueOrThrow({
      where: { id: linkInvite.membershipId },
      select: { status: true, acceptedAt: true },
    })
    expect(linkMembership.status).toBe('INVITED')
    expect(linkMembership.acceptedAt).toBeNull()

    const opened = openPortalInvite(linkInvite.inviteToken!, env.AUTH_SECRET)
    expect(opened).toEqual({
      membershipId: linkInvite.membershipId,
      orgId: organization.id,
    })

    const peek = await portalService.peekPortalInvite(linkInvite.inviteToken!)
    expect(peek?.email).toBe(`link-${stamp}@test.invalid`)
    expect(peek?.organizationName).toBe(organization.name)
    expect(peek?.orgId).toBe(organization.id)

    const accepted = await portalService.acceptPortalInvite({
      token: linkInvite.inviteToken!,
      name: 'Link Guest',
      password: 'chosen-pass-9',
      confirmPassword: 'chosen-pass-9',
    })
    expect(accepted.orgId).toBe(organization.id)
    expect(accepted.email).toBe(`link-${stamp}@test.invalid`)

    const after = await db.membership.findUniqueOrThrow({
      where: { id: linkInvite.membershipId },
      select: { status: true, acceptedAt: true },
    })
    expect(after.status).toBe('ACTIVE')
    expect(after.acceptedAt).not.toBeNull()

    const userAfter = await db.user.findUniqueOrThrow({
      where: { id: linkInvite.userId },
      select: { passwordHash: true },
    })
    expect(userAfter.passwordHash).toBeTruthy()
  })
})

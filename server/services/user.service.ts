import 'server-only'

import type { Prisma, Role } from '@prisma/client'

import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { ResetSystemUserPasswordInput } from '@/lib/validation/user'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import { sanitizePermissions } from '@/server/auth/permissions'
import { db } from '@/server/db'
import { conflict, forbidden, notFound, precondition, validation } from '@/server/errors'

export async function updateProfile(
  ctx: OrgContext,
  input: { name: string; phone?: string | null },
) {
  const meta = await requestMeta()

  if (input.phone) {
    const taken = await db.user.findFirst({
      where: { phone: input.phone, NOT: { id: ctx.userId } },
      select: { id: true },
    })
    if (taken) {
      throw validation('That mobile number is already used on another login.', {
        phone: ['That mobile number is already used on another login.'],
      })
    }
  }

  return db.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, name: true, email: true, phone: true },
    })
    if (!before) throw notFound('User')

    const after = await tx.user.update({
      where: { id: ctx.userId },
      data: {
        name: input.name,
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
      select: { id: true, name: true, email: true, phone: true },
    })

    await writeAudit(
      tx,
      ctx,
      { entity: 'User', entityId: ctx.userId, action: 'UPDATE', before, after },
      meta,
    )
    return after
  })
}

export async function changePassword(
  ctx: OrgContext,
  input: { currentPassword: string; newPassword: string },
) {
  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { passwordHash: true },
  })
  if (!user?.passwordHash) throw notFound('User')

  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw validation('Your current password is not correct.', {
      currentPassword: ['Your current password is not correct.'],
    })
  }

  const passwordHash = await hashPassword(input.newPassword)
  const meta = await requestMeta()

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: ctx.userId }, data: { passwordHash } })
    // Never log the hash, old or new — only that it changed.
    await writeAudit(
      tx,
      ctx,
      { entity: 'User', entityId: ctx.userId, action: 'UPDATE', after: { passwordChanged: true } },
      meta,
    )
  })

  return { ok: true as const }
}

async function assertCurrentPassword(userId: string, currentPassword: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  })
  if (!user?.passwordHash) throw notFound('User')
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw validation('Your current password is not correct.', {
      currentPassword: ['Your current password is not correct.'],
    })
  }
}

/** Opt-in desk unlock PIN. Null deskPinHash means off (password unlock only). */
export async function setDeskPin(ctx: OrgContext, input: { currentPassword: string; pin: string }) {
  await assertCurrentPassword(ctx.userId, input.currentPassword)
  const deskPinHash = await hashPassword(input.pin)
  const meta = await requestMeta()

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: ctx.userId }, data: { deskPinHash } })
    await writeAudit(
      tx,
      ctx,
      { entity: 'User', entityId: ctx.userId, action: 'UPDATE', after: { deskPinChanged: true } },
      meta,
    )
  })

  return { ok: true as const }
}

export async function clearDeskPin(ctx: OrgContext, input: { currentPassword: string }) {
  await assertCurrentPassword(ctx.userId, input.currentPassword)
  const meta = await requestMeta()

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: ctx.userId }, data: { deskPinHash: null } })
    await writeAudit(
      tx,
      ctx,
      { entity: 'User', entityId: ctx.userId, action: 'UPDATE', after: { deskPinCleared: true } },
      meta,
    )
  })

  return { ok: true as const }
}

const SYSTEM_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  isSystemOwner: true,
  lastLoginAt: true,
  lastSeenAt: true,
  createdAt: true,
  homeOrgId: true,
  totpEnabledAt: true,
  otp2faEnabledAt: true,
  // Include CUSTOMER rows too — the console splits staff vs portal so
  // portal-only logins are not mislabeled “No company”.
  memberships: {
    select: {
      id: true,
      role: true,
      status: true,
      organization: {
        select: {
          id: true,
          name: true,
          parentOrgId: true,
          parent: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { organization: { name: 'asc' as const } },
  },
} satisfies Prisma.UserSelect

/**
 * Every staff login on this installation. System owner only — never selects passwordHash.
 */
export async function listSystemUsers(ctx: OrgContext, query: ListQuery) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can see every user on the system.')
  }

  const where: Prisma.UserWhereInput = {
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      select: SYSTEM_USER_SELECT,
      orderBy: [{ isSystemOwner: 'desc' }, { name: 'asc' }],
      ...paginate(query),
    }),
    db.user.count({ where }),
  ])

  return paged(rows, total, query)
}

/**
 * System owner sets a new temporary work password. The previous password is
 * never read or returned — only the new value is shown once in the UI.
 */
export async function adminResetPassword(ctx: OrgContext, input: ResetSystemUserPasswordInput) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can reset passwords across companies.')
  }

  if (input.userId === ctx.userId) {
    throw precondition('Change your own password under Settings → Your profile.')
  }

  const meta = await requestMeta()
  const passwordHash = await hashPassword(input.temporaryPassword)

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true, email: true, isSystemOwner: true },
    })
    if (!user) throw notFound('User')

    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })
    // Invalidate every company session for this login.
    await tx.membership.updateMany({
      where: { userId: user.id },
      data: { version: { increment: 1 } },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'User',
        entityId: user.id,
        action: 'UPDATE',
        after: { passwordReset: true, email: user.email },
      },
      meta,
    )

    return {
      id: user.id,
      temporaryPassword: input.temporaryPassword,
      email: user.email,
      name: user.name,
    }
  })
}

export type SystemUserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED'

/**
 * Set pending / active / suspended on every staff membership this login has,
 * except company owners (ownership must be transferred first).
 */
export async function setSystemUserStatus(
  ctx: OrgContext,
  userId: string,
  status: SystemUserStatus,
) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can change a login across companies.')
  }
  if (userId === ctx.userId) {
    throw precondition('You cannot change your own access from here.')
  }

  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isSystemOwner: true,
        memberships: {
          where: { role: { not: 'CUSTOMER' } },
          select: { id: true, role: true, status: true },
        },
      },
    })
    if (!user) throw notFound('User')
    if (user.isSystemOwner) {
      throw forbidden('The system owner cannot be set pending or suspended.')
    }

    const staff = user.memberships.filter((row) => row.role !== 'OWNER')
    if (staff.length === 0) {
      throw precondition(
        user.memberships.some((row) => row.role === 'OWNER')
          ? 'This person owns a company. Transfer ownership first.'
          : 'This person has no company membership to change.',
      )
    }

    await tx.membership.updateMany({
      where: { id: { in: staff.map((row) => row.id) } },
      data: { status, version: { increment: 1 } },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'User',
        entityId: user.id,
        action: status === 'ACTIVE' ? 'RESTORE' : 'ARCHIVE',
        before: { memberships: user.memberships.map((row) => row.status) },
        after: { status, email: user.email },
      },
      meta,
    )

    return { id: user.id, name: user.name, email: user.email, status }
  })
}

/**
 * Remove a login from the installation. Company owners and the system owner stay.
 * Calendar / approval history that still names this person blocks the delete.
 */
export async function deleteSystemUser(ctx: OrgContext, userId: string) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can delete a login.')
  }
  if (userId === ctx.userId) {
    throw precondition('You cannot delete your own login.')
  }

  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isSystemOwner: true,
        memberships: {
          where: { role: 'OWNER' },
          select: { organization: { select: { name: true } } },
        },
        _count: {
          select: {
            calendarEvents: true,
            approvalRequestsSubmitted: true,
            approvalDecisions: true,
          },
        },
      },
    })
    if (!user) throw notFound('User')
    if (user.isSystemOwner) {
      throw forbidden('The system owner cannot be deleted.')
    }
    const owned = user.memberships[0]?.organization.name
    if (owned) {
      throw precondition(`This person owns ${owned}. Transfer ownership first.`)
    }
    if (user._count.calendarEvents > 0) {
      throw precondition('This person created calendar events. Suspend them instead of deleting.')
    }
    if (user._count.approvalRequestsSubmitted > 0 || user._count.approvalDecisions > 0) {
      throw precondition('This person took part in approvals. Suspend them instead of deleting.')
    }

    await tx.appAccessRequest.deleteMany({ where: { requestedById: user.id } })
    await tx.user.delete({ where: { id: user.id } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'User',
        entityId: user.id,
        action: 'DELETE',
        before: { email: user.email, name: user.name },
      },
      meta,
    )

    return { id: user.id, name: user.name, email: user.email }
  })
}

export async function listAssignableCompanies(ctx: OrgContext) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can assign people across companies.')
  }
  return db.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

/** End every open session for this login (all companies). */
export async function forceSignOutUser(ctx: OrgContext, userId: string) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can force sign-out across companies.')
  }
  if (userId === ctx.userId) {
    throw precondition('You cannot force sign-out your own session from here.')
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  })
  if (!user) throw notFound('User')

  const meta = await requestMeta()
  await db.$transaction(async (tx) => {
    await tx.membership.updateMany({
      where: { userId },
      data: { version: { increment: 1 } },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'User',
        entityId: userId,
        action: 'UPDATE',
        after: { forcedSignOut: true, email: user.email },
      },
      meta,
    )
  })

  return { id: user.id, name: user.name, email: user.email }
}

export async function adminDisableUserTwoFactor(ctx: OrgContext, userId: string) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can turn off two-factor across companies.')
  }
  if (userId === ctx.userId) {
    throw precondition('Turn off your own two-factor under Settings → Your profile.')
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      isSystemOwner: true,
      totpEnabledAt: true,
      otp2faEnabledAt: true,
    },
  })
  if (!user) throw notFound('User')
  if (user.isSystemOwner) {
    throw forbidden('Cannot turn off two-factor for another system owner from here.')
  }
  if (!user.totpEnabledAt && !user.otp2faEnabledAt) {
    throw precondition('Two-factor is not on for this login.')
  }

  const meta = await requestMeta()
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        totpEnabledAt: null,
        totpSecretSealed: null,
        otp2faEnabledAt: null,
      },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'User',
        entityId: userId,
        action: 'UPDATE',
        after: { twoFactorDisabledByAdmin: true, email: user.email },
      },
      meta,
    )
  })

  return { id: user.id, name: user.name, email: user.email }
}

/**
 * Put an existing login into a company as staff (system owner console).
 * Does not create a new password — they keep the one they already have.
 */
export async function addUserToCompany(
  ctx: OrgContext,
  input: { userId: string; orgId: string; role: Role },
) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can add people to any company.')
  }
  if (input.role === 'OWNER' || input.role === 'CUSTOMER') {
    throw validation('Choose a staff role, not Owner or Customer portal.')
  }

  const [user, org] = await Promise.all([
    db.user.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true, email: true, homeOrgId: true },
    }),
    db.organization.findUnique({
      where: { id: input.orgId },
      select: { id: true, name: true, maxUsers: true },
    }),
  ])
  if (!user) throw notFound('User')
  if (!org) throw notFound('Company')

  const existing = await db.membership.findUnique({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
    select: { id: true, role: true },
  })
  if (existing) {
    throw conflict(
      existing.role === 'CUSTOMER'
        ? 'That login is already a customer portal user on this company.'
        : 'That person is already a member of this company.',
    )
  }

  if (org.maxUsers != null && org.maxUsers > 0) {
    const activeUsers = await db.membership.count({
      where: { orgId: org.id, status: 'ACTIVE' },
    })
    if (activeUsers >= org.maxUsers) {
      throw precondition(`This company is limited to ${org.maxUsers} users.`)
    }
  }

  const meta = await requestMeta()
  const role = input.role
  const permissionsOverride = sanitizePermissions([])

  return db.$transaction(async (tx) => {
    if (!user.homeOrgId) {
      await tx.user.update({
        where: { id: user.id },
        data: { homeOrgId: org.id },
      })
    }

    const membership = await tx.membership.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role,
        permissionsOverride,
        status: 'ACTIVE',
        invitedById: ctx.userId,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
      select: { id: true },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Membership',
        entityId: membership.id,
        action: 'CREATE',
        after: { email: user.email, role, orgId: org.id, orgName: org.name },
      },
      meta,
    )

    return {
      membershipId: membership.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      orgId: org.id,
      orgName: org.name,
      role,
    }
  })
}

/**
 * Delete leftover logins with no company staff membership and no portal access.
 * System owners are never removed. Used to clean the platform console.
 */
export async function deleteUnusedSystemUsers(ctx: OrgContext) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can clean unused logins.')
  }

  const candidates = await db.user.findMany({
    where: {
      id: { not: ctx.userId },
      isSystemOwner: false,
      memberships: { none: {} },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  const deleted: { id: string; name: string; email: string }[] = []
  const skipped: { id: string; name: string; email: string; reason: string }[] = []

  for (const candidate of candidates) {
    try {
      const result = await deleteSystemUser(ctx, candidate.id)
      deleted.push(result)
    } catch (error) {
      skipped.push({
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        reason: error instanceof Error ? error.message : 'Could not delete.',
      })
    }
  }

  return { deleted, skipped }
}

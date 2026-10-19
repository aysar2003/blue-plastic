import 'server-only'

import type { Prisma } from '@prisma/client'

import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { ResetSystemUserPasswordInput } from '@/lib/validation/user'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import { db } from '@/server/db'
import { forbidden, notFound, precondition, validation } from '@/server/errors'

export async function updateProfile(ctx: OrgContext, input: { name: string }) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, name: true, email: true },
    })
    if (!before) throw notFound('User')

    const after = await tx.user.update({
      where: { id: ctx.userId },
      data: { name: input.name },
      select: { id: true, name: true, email: true },
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

const SYSTEM_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  isSystemOwner: true,
  lastLoginAt: true,
  createdAt: true,
  homeOrgId: true,
  memberships: {
    where: { role: { not: 'CUSTOMER' } },
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

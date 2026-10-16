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
      organization: { select: { id: true, name: true } },
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

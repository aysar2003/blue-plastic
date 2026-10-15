import 'server-only'
import type { Prisma, Role } from '@prisma/client'

import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { InviteUserInput, UpdateMemberRoleInput } from '@/lib/validation/user'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { hashPassword } from '@/server/auth/password'
import { sanitizePermissions } from '@/server/auth/permissions'
import { db } from '@/server/db'
import { conflict, forbidden, notFound, precondition, validation } from '@/server/errors'

const MEMBER_SELECT = {
  id: true,
  role: true,
  status: true,
  version: true,
  permissionsOverride: true,
  canConnect: true,
  createdAt: true,
  acceptedAt: true,
  user: { select: { id: true, name: true, email: true, image: true, lastLoginAt: true } },
} satisfies Prisma.MembershipSelect

export type MemberRow = Prisma.MembershipGetPayload<{ select: typeof MEMBER_SELECT }>

function resolveAccess(role: string, permissionsOverride: readonly string[] | undefined) {
  if (role === 'CUSTOMER') {
    throw forbidden('Customer portal logins are invited from the customer record, not from Users.')
  }
  const cleaned = sanitizePermissions(permissionsOverride)
  if (role === 'CUSTOM') {
    if (cleaned.length === 0) {
      throw validation('Choose at least one permission for custom access.')
    }
    return { role: 'CUSTOM' as Role, permissionsOverride: cleaned }
  }
  return { role: role as Role, permissionsOverride: [] as string[] }
}

export async function list(ctx: OrgContext, query: ListQuery) {
  const where: Prisma.MembershipWhereInput = {
    orgId: ctx.orgId,
    // Portal logins are managed under Customers → Portal users, not Settings → Users.
    role: { not: 'CUSTOMER' },
    ...(query.q
      ? {
          user: {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.membership.findMany({
      where,
      select: MEMBER_SELECT,
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      ...paginate(query),
    }),
    db.membership.count({ where }),
  ])

  return paged(rows, total, query)
}

export async function invite(ctx: OrgContext, input: InviteUserInput) {
  const meta = await requestMeta()
  const passwordHash = await hashPassword(input.temporaryPassword)
  const access = resolveAccess(input.role, input.permissionsOverride)

  return db.$transaction(async (tx) => {
    const orgLimits = await tx.organization.findUnique({
      where: { id: ctx.orgId },
      select: { maxUsers: true },
    })
    if (orgLimits?.maxUsers != null && orgLimits.maxUsers > 0) {
      const activeUsers = await tx.membership.count({
        where: { orgId: ctx.orgId, status: 'ACTIVE' },
      })
      if (activeUsers >= orgLimits.maxUsers) {
        throw precondition(
          `This company is limited to ${orgLimits.maxUsers} users. Remove someone or ask the system owner to raise the limit.`,
        )
      }
    }

    const existingUser = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true, passwordHash: true, homeOrgId: true },
    })

    if (existingUser) {
      const existingMembership = await tx.membership.findUnique({
        where: { orgId_userId: { orgId: ctx.orgId, userId: existingUser.id } },
        select: { id: true, status: true },
      })
      if (existingMembership) {
        throw conflict('That person is already a member of this organisation.')
      }
    }

    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
          homeOrgId: ctx.orgId,
        },
        select: { id: true, passwordHash: true, homeOrgId: true },
      }))

    if (existingUser && !existingUser.homeOrgId) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: { homeOrgId: ctx.orgId },
      })
    }

    const membership = await tx.membership.create({
      data: {
        orgId: ctx.orgId,
        userId: user.id,
        role: access.role,
        permissionsOverride: access.permissionsOverride,
        // No email delivery yet, so the invitee can sign in immediately with the
        // password the inviter set. See the note on `inviteUserSchema`.
        status: 'ACTIVE',
        invitedById: ctx.userId,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
      select: MEMBER_SELECT,
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Membership',
        entityId: membership.id,
        action: 'CREATE',
        after: {
          email: input.email,
          role: access.role,
          permissionsOverride: access.permissionsOverride,
        },
      },
      meta,
    )

    return membership
  })
}

export async function updateAccess(ctx: OrgContext, input: UpdateMemberRoleInput) {
  const meta = await requestMeta()
  const access = resolveAccess(input.role, input.permissionsOverride)

  return db.$transaction(async (tx) => {
    const before = await tx.membership.findFirst({
      where: { id: input.membershipId, orgId: ctx.orgId },
      select: MEMBER_SELECT,
    })
    if (!before) throw notFound('Member')

    assertNotLastOwnerChange(ctx, before, access.role)

    const after = await tx.membership.update({
      where: { id: input.membershipId },
      // Bumping `version` invalidates any JWT already issued to this user, so a
      // demotion takes effect on their next request rather than at token expiry.
      data: {
        role: access.role,
        permissionsOverride: access.permissionsOverride,
        version: { increment: 1 },
        ...(access.role === 'ADMIN' ? {} : { canConnect: false }),
      },
      select: MEMBER_SELECT,
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Membership',
        entityId: input.membershipId,
        action: 'UPDATE',
        before: {
          role: before.role,
          permissionsOverride: before.permissionsOverride,
        },
        after: {
          role: after.role,
          permissionsOverride: after.permissionsOverride,
        },
      },
      meta,
    )

    return after
  })
}

/** @deprecated Prefer updateAccess — kept for role-only callers. */
export async function updateRole(ctx: OrgContext, membershipId: string, role: Role) {
  if (role === 'OWNER') {
    throw forbidden('The owner role cannot be assigned here. Transfer ownership instead.')
  }
  if (role === 'CUSTOMER') {
    throw forbidden('Customer portal logins are invited from the customer record, not from Users.')
  }
  return updateAccess(ctx, {
    membershipId,
    role: role as Exclude<Role, 'OWNER' | 'CUSTOMER'>,
    permissionsOverride: [],
  })
}

export async function setStatus(
  ctx: OrgContext,
  membershipId: string,
  status: 'ACTIVE' | 'SUSPENDED',
) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const before = await tx.membership.findFirst({
      where: { id: membershipId, orgId: ctx.orgId },
      select: MEMBER_SELECT,
    })
    if (!before) throw notFound('Member')

    if (before.user.id === ctx.userId) {
      throw precondition('You cannot suspend your own access.')
    }
    if (before.role === 'OWNER') {
      throw forbidden('The owner cannot be suspended. Transfer ownership first.')
    }

    const after = await tx.membership.update({
      where: { id: membershipId },
      data: { status, version: { increment: 1 } },
      select: MEMBER_SELECT,
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Membership',
        entityId: membershipId,
        action: status === 'ACTIVE' ? 'RESTORE' : 'ARCHIVE',
        before: { status: before.status },
        after: { status: after.status },
      },
      meta,
    )

    return after
  })
}

export async function remove(ctx: OrgContext, membershipId: string) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { id: membershipId, orgId: ctx.orgId },
      select: MEMBER_SELECT,
    })
    if (!membership) throw notFound('Member')

    if (membership.user.id === ctx.userId) {
      throw precondition('You cannot remove yourself from the organisation.')
    }
    if (membership.role === 'OWNER') {
      throw forbidden('The owner cannot be removed. Transfer ownership first.')
    }

    await tx.membership.delete({ where: { id: membershipId } })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Membership',
        entityId: membershipId,
        action: 'DELETE',
        before: { email: membership.user.email, role: membership.role },
      },
      meta,
    )

    // The user row itself is kept: audit rows reference it, and an accounting
    // system must be able to say who entered a transaction years later.
    return { id: membershipId }
  })
}

/**
 * Connect is the switch between company databases. It can be given only to an
 * admin, and only by the system owner. Other people stay in their own company.
 */
export async function setCanConnect(ctx: OrgContext, membershipId: string, canConnect: boolean) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can allow Connect.')
  }

  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const before = await tx.membership.findFirst({
      where: { id: membershipId, orgId: ctx.orgId },
      select: MEMBER_SELECT,
    })
    if (!before) throw notFound('Member')
    if (before.user.id === ctx.userId) {
      throw precondition('You already open every company.')
    }
    if (before.role !== 'ADMIN') {
      throw validation('Connect can only be given to an admin.')
    }

    const after = await tx.membership.update({
      where: { id: membershipId },
      data: { canConnect },
      select: MEMBER_SELECT,
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Membership',
        entityId: membershipId,
        action: 'UPDATE',
        before: { canConnect: before.canConnect },
        after: { canConnect: after.canConnect, email: after.user.email },
      },
      meta,
    )

    return after
  })
}

/**
 * An organisation without an owner has nobody who can restore access to it. The
 * check is here rather than in the UI because it is a data-integrity rule.
 */
function assertNotLastOwnerChange(ctx: OrgContext, member: MemberRow, nextRole: Role) {
  if (member.role !== 'OWNER') return
  if (nextRole === 'OWNER') return
  throw forbidden('The owner role cannot be changed here. Transfer ownership instead.')
}

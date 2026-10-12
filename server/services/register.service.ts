import 'server-only'

import type { Prisma } from '@prisma/client'

import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'
import type { SetupInput } from '@/lib/validation/auth'
import type { OrgContext } from '@/server/auth/context'
import { hashPassword } from '@/server/auth/password'
import { db } from '@/server/db'
import { conflict, forbidden, notFound } from '@/server/errors'
import { createDefaultSequences } from '@/server/sequences'
import { needsSetup } from '@/server/services/setup.service'

/**
 * Public /register stays available so businesses can *request* a company.
 * Set SELF_SERVE_COMPANIES=false to hide /register after the first company exists.
 */
export function isSelfServeEnabled(): boolean {
  const raw = process.env.SELF_SERVE_COMPANIES
  if (raw === 'false' || raw === '0') return false
  return true
}

export type RegisterResult =
  | { kind: 'created'; organizationId: string; userId: string; email: string }
  | { kind: 'pending'; requestId: string; email: string }

/**
 * First company on an empty instance is created immediately (bootstrap).
 * Later public registrations become PENDING — no login until a system owner
 * approves them under Databases.
 */
export async function registerCompany(input: SetupInput): Promise<RegisterResult> {
  const empty = await needsSetup()
  if (!empty && !isSelfServeEnabled()) {
    throw forbidden(
      'Public registration is turned off. Ask the system owner for access, or set SELF_SERVE_COMPANIES=true.',
    )
  }

  const email = input.email.trim().toLowerCase()
  const orgName = input.organizationName.trim()

  const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existingUser) {
    throw conflict('That email already has an account. Sign in instead, or use a different email.')
  }

  const nameTaken = await db.organization.findFirst({
    where: { name: { equals: orgName, mode: 'insensitive' } },
    select: { id: true },
  })
  if (nameTaken) {
    throw conflict('A company with that name already exists. Choose another name.')
  }

  if (empty) {
    const passwordHash = await hashPassword(input.password)
    return db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: orgName,
          baseCurrency: input.baseCurrency,
          fiscalYearStartMonth: input.fiscalYearStartMonth,
          featureFlags: DEFAULT_FEATURE_FLAGS as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, name: true },
      })

      const user = await tx.user.create({
        data: {
          email,
          name: input.name.trim(),
          passwordHash,
          emailVerified: new Date(),
          isSystemOwner: true,
          homeOrgId: organization.id,
        },
        select: { id: true, email: true },
      })

      await tx.membership.create({
        data: {
          orgId: organization.id,
          userId: user.id,
          role: 'OWNER',
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      })

      await createDefaultSequences(tx, organization.id)

      await tx.auditLog.create({
        data: {
          orgId: organization.id,
          actorId: user.id,
          entity: 'Organization',
          entityId: organization.id,
          action: 'CREATE',
          after: { name: organization.name, owner: user.email, systemOwner: true },
        },
      })

      return {
        kind: 'created' as const,
        organizationId: organization.id,
        userId: user.id,
        email: user.email,
      }
    })
  }

  const pendingSameEmail = await db.companySignupRequest.findFirst({
    where: { email, status: 'PENDING' },
    select: { id: true },
  })
  if (pendingSameEmail) {
    throw conflict('A request with this email is already waiting for approval.')
  }

  const pendingSameName = await db.companySignupRequest.findFirst({
    where: {
      status: 'PENDING',
      organizationName: { equals: orgName, mode: 'insensitive' },
    },
    select: { id: true },
  })
  if (pendingSameName) {
    throw conflict('A request for that company name is already waiting for approval.')
  }

  const passwordHash = await hashPassword(input.password)
  const request = await db.companySignupRequest.create({
    data: {
      organizationName: orgName,
      baseCurrency: input.baseCurrency,
      fiscalYearStartMonth: input.fiscalYearStartMonth,
      ownerName: input.name.trim(),
      email,
      passwordHash,
      status: 'PENDING',
    },
    select: { id: true, email: true },
  })

  return { kind: 'pending', requestId: request.id, email: request.email }
}

export type SignupRequestRow = {
  id: string
  organizationName: string
  baseCurrency: string
  fiscalYearStartMonth: number
  ownerName: string
  email: string
  createdAt: string
}

/** Pending public registrations — system owner only. */
export async function listPendingSignupRequests(ctx: OrgContext): Promise<SignupRequestRow[]> {
  if (!ctx.isSystemOwner) return []
  const rows = await db.companySignupRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      organizationName: true,
      baseCurrency: true,
      fiscalYearStartMonth: true,
      ownerName: true,
      email: true,
      createdAt: true,
    },
  })
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }))
}

/** Approve → create company + owner. Reject → no account, no books. */
export async function reviewSignupRequest(
  ctx: OrgContext,
  input: { id: string; decision: 'approve' | 'reject'; note?: string },
) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can approve company registrations.')
  }

  const request = await db.companySignupRequest.findUnique({ where: { id: input.id } })
  if (!request) throw notFound('Registration request')
  if (request.status !== 'PENDING') {
    throw conflict('This request was already reviewed.')
  }

  if (input.decision === 'reject') {
    await db.companySignupRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: ctx.userId,
        note: input.note?.trim() || null,
        passwordHash: '',
      },
    })
    return { decision: 'reject' as const, id: request.id }
  }

  const emailTaken = await db.user.findUnique({
    where: { email: request.email },
    select: { id: true },
  })
  if (emailTaken) {
    throw conflict('That email already has an account. Reject this request or ask them to sign in.')
  }

  const nameTaken = await db.organization.findFirst({
    where: { name: { equals: request.organizationName, mode: 'insensitive' } },
    select: { id: true },
  })
  if (nameTaken) {
    throw conflict('A company with that name already exists. Reject this request.')
  }

  const created = await db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: request.organizationName,
        baseCurrency: request.baseCurrency,
        fiscalYearStartMonth: request.fiscalYearStartMonth,
        featureFlags: DEFAULT_FEATURE_FLAGS as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, name: true },
    })

    const user = await tx.user.create({
      data: {
        email: request.email,
        name: request.ownerName,
        passwordHash: request.passwordHash,
        emailVerified: new Date(),
        isSystemOwner: false,
        homeOrgId: organization.id,
      },
      select: { id: true, email: true },
    })

    await tx.membership.create({
      data: {
        orgId: organization.id,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    })

    await createDefaultSequences(tx, organization.id)

    await tx.companySignupRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: ctx.userId,
        note: input.note?.trim() || null,
        organizationId: organization.id,
        passwordHash: '',
      },
    })

    await tx.auditLog.create({
      data: {
        orgId: organization.id,
        actorId: ctx.userId,
        entity: 'Organization',
        entityId: organization.id,
        action: 'CREATE',
        after: {
          name: organization.name,
          owner: user.email,
          approvedSignupRequestId: request.id,
        },
      },
    })

    return { organizationId: organization.id, name: organization.name, email: user.email }
  })

  return { decision: 'approve' as const, id: request.id, ...created }
}

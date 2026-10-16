import 'server-only'

import type { Prisma } from '@prisma/client'

import { companyLimitStatus } from '@/lib/company-limits'
import { MAX_SUB_COMPANIES } from '@/lib/company-group'
import {
  featureFlagsWithModules,
  modulesFromFormValues,
  parseFeatureFlags,
} from '@/lib/feature-flags'
import type {
  AttachSubCompanyInput,
  CreateCompanyInput,
  DeleteCompanyInput,
  UpdateCompanyLimitsInput,
} from '@/lib/validation/company'
import { seedChartOfAccounts } from '@/server/accounting/chart-of-accounts'
import type { OrgContext } from '@/server/auth/context'
import { allowCompanyWipe } from '@/server/company-wipe'
import { db } from '@/server/db'
import { conflict, forbidden, notFound, precondition, validation } from '@/server/errors'
import { createDefaultSequences } from '@/server/sequences'
import { countSubCompanies } from '@/server/services/company-group.service'

/**
 * Start another company on this instance. The signed-in user becomes its owner.
 * Books stay separate — each company has its own ledger, contacts, and stock.
 * Optionally nest under a main company (max 2 subs).
 */
export async function createCompany(ctx: OrgContext, input: CreateCompanyInput) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can add a company.')
  }

  const name = input.name.trim()
  const taken = await db.organization.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  })
  if (taken) throw conflict('A company with that name already exists.')

  const parentOrgId = input.parentOrgId?.trim() || null
  let parentName: string | null = null
  if (parentOrgId) {
    const parent = await db.organization.findUnique({
      where: { id: parentOrgId },
      select: { id: true, name: true, parentOrgId: true },
    })
    if (!parent) throw notFound('Main company')
    if (parent.parentOrgId) {
      throw validation('A sub-company cannot be a main. Choose a main company.')
    }
    const childCount = await countSubCompanies(parent.id)
    if (childCount >= MAX_SUB_COMPANIES) {
      throw precondition(
        `A main company can have at most ${MAX_SUB_COMPANIES} sub-companies.`,
      )
    }
    parentName = parent.name
  }

  const modules = modulesFromFormValues(input as Record<string, unknown>)

  return db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name,
        baseCurrency: input.baseCurrency,
        fiscalYearStartMonth: input.fiscalYearStartMonth,
        timeZone: ctx.organization.timeZone,
        parentOrgId,
        featureFlags: featureFlagsWithModules(modules) as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, name: true, baseCurrency: true, parentOrgId: true },
    })

    await tx.membership.create({
      data: {
        orgId: organization.id,
        userId: ctx.userId,
        role: 'OWNER',
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    })

    // Main company OWNER/ADMIN staff can open the sub and see its work.
    if (parentOrgId) {
      const mainAdmins = await tx.membership.findMany({
        where: {
          orgId: parentOrgId,
          status: 'ACTIVE',
          role: { in: ['OWNER', 'ADMIN'] },
          userId: { not: ctx.userId },
        },
        select: { userId: true, role: true, canConnect: true },
      })
      for (const admin of mainAdmins) {
        await tx.membership.create({
          data: {
            orgId: organization.id,
            userId: admin.userId,
            role: admin.role === 'OWNER' ? 'ADMIN' : admin.role,
            status: 'ACTIVE',
            canConnect: true,
            acceptedAt: new Date(),
          },
        })
      }
      // Creator can switch between main and subs.
      await tx.membership.update({
        where: { orgId_userId: { orgId: organization.id, userId: ctx.userId } },
        data: { canConnect: true },
      })
      await tx.membership.updateMany({
        where: {
          orgId: parentOrgId,
          userId: ctx.userId,
          status: 'ACTIVE',
        },
        data: { canConnect: true },
      })
    }

    await createDefaultSequences(tx, organization.id)

    if (input.seedChart) {
      await seedChartOfAccounts(tx, organization.id)
    }

    await tx.auditLog.create({
      data: {
        orgId: organization.id,
        actorId: ctx.userId,
        entity: 'Organization',
        entityId: organization.id,
        action: 'CREATE',
        after: {
          name: organization.name,
          createdAsAdditionalCompany: true,
          parentOrgId,
          parentName,
        },
      },
    })

    return organization
  })
}

/**
 * Put an existing standalone company under a main (system owner).
 * The company must not already have a parent or its own children.
 */
export async function attachSubCompany(ctx: OrgContext, input: AttachSubCompanyInput) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can attach a sub-company.')
  }
  if (input.orgId === input.parentOrgId) {
    throw validation('A company cannot be a sub of itself.')
  }

  const [org, parent] = await Promise.all([
    db.organization.findUnique({
      where: { id: input.orgId },
      select: {
        id: true,
        name: true,
        parentOrgId: true,
        _count: { select: { children: true } },
      },
    }),
    db.organization.findUnique({
      where: { id: input.parentOrgId },
      select: { id: true, name: true, parentOrgId: true },
    }),
  ])
  if (!org) throw notFound('Company')
  if (!parent) throw notFound('Main company')
  if (org.parentOrgId) throw conflict('That company is already a sub-company.')
  if (org._count.children > 0) {
    throw precondition('A main company with sub-companies cannot become a sub.')
  }
  if (parent.parentOrgId) {
    throw validation('A sub-company cannot be a main. Choose a main company.')
  }

  const childCount = await countSubCompanies(parent.id)
  if (childCount >= MAX_SUB_COMPANIES) {
    throw precondition(
      `A main company can have at most ${MAX_SUB_COMPANIES} sub-companies.`,
    )
  }

  await db.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: org.id },
      data: { parentOrgId: parent.id },
    })

    const mainAdmins = await tx.membership.findMany({
      where: {
        orgId: parent.id,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { userId: true, role: true },
    })
    for (const admin of mainAdmins) {
      await tx.membership.upsert({
        where: { orgId_userId: { orgId: org.id, userId: admin.userId } },
        create: {
          orgId: org.id,
          userId: admin.userId,
          role: admin.role === 'OWNER' ? 'ADMIN' : admin.role,
          status: 'ACTIVE',
          canConnect: true,
          acceptedAt: new Date(),
        },
        update: { status: 'ACTIVE', canConnect: true },
      })
    }

    await tx.auditLog.create({
      data: {
        orgId: org.id,
        actorId: ctx.userId,
        entity: 'Organization',
        entityId: org.id,
        action: 'UPDATE',
        after: { parentOrgId: parent.id, parentName: parent.name, attachedAsSub: true },
      },
    })
  })

  return { orgId: org.id, name: org.name, parentOrgId: parent.id, parentName: parent.name }
}

/**
 * Permanently remove a company and every row that belongs to it.
 * Download a backup first — Import can recreate the company (master data) later.
 */
export async function deleteCompany(ctx: OrgContext, input: DeleteCompanyInput) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can delete a company database.')
  }

  const organization = await db.organization.findUnique({
    where: { id: input.orgId },
    select: {
      id: true,
      name: true,
      parentOrgId: true,
      _count: { select: { children: true } },
    },
  })
  if (!organization) throw notFound('Company')

  const typed = input.confirmName.trim()
  if (typed.toLowerCase() !== organization.name.trim().toLowerCase()) {
    throw validation('Type the company name exactly to confirm deletion.')
  }

  if (organization._count.children > 0) {
    throw precondition(
      'Remove or reassign sub-companies before deleting this main company.',
    )
  }

  const total = await db.organization.count()
  if (total <= 1) {
    throw precondition('This is the only company on the system. It cannot be deleted.')
  }

  const fallback = await db.organization.findFirst({
    where: { id: { not: organization.id } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  if (!fallback) throw precondition('No other company remains to open after deletion.')

  await db.$transaction(async (tx) => {
    await allowCompanyWipe(tx)
    await tx.journal.updateMany({ where: { orgId: organization.id }, data: { reversalOfId: null } })
    await tx.ledgerAccount.updateMany({ where: { orgId: organization.id }, data: { parentId: null } })
    await tx.salesDocument.updateMany({
      where: { orgId: organization.id },
      data: { convertedFromId: null },
    })
    await tx.purchaseDocument.updateMany({
      where: { orgId: organization.id },
      data: { convertedFromId: null },
    })
    await tx.user.updateMany({
      where: { homeOrgId: organization.id },
      data: { homeOrgId: fallback.id },
    })
    await tx.organization.delete({ where: { id: organization.id } })
  })

  return {
    deletedId: organization.id,
    deletedName: organization.name,
    switchToOrgId: ctx.orgId === organization.id ? fallback.id : null,
    switchToName: fallback.name,
  }
}

const LIMIT_SELECT = {
  id: true,
  name: true,
  accessRestricted: true,
  rentExpiresAt: true,
  maxUsers: true,
  rentNote: true,
  featureFlags: true,
} as const

/**
 * Set lock / rent end / max users / apps for a company database.
 * Only the system owner manages these limits.
 */
export async function updateCompanyLimits(ctx: OrgContext, input: UpdateCompanyLimitsInput) {
  if (!ctx.isSystemOwner) {
    throw forbidden('Only the system owner can set company limits.')
  }

  const organization = await db.organization.findUnique({
    where: { id: input.orgId },
    select: LIMIT_SELECT,
  })
  if (!organization) throw notFound('Company')

  const activeUsers = await db.membership.count({
    where: { orgId: organization.id, status: 'ACTIVE' },
  })
  if (input.maxUsers != null && input.maxUsers < activeUsers) {
    throw validation(
      `This company already has ${activeUsers} users. Raise the limit or remove users first.`,
    )
  }

  const current = parseFeatureFlags(organization.featureFlags)
  const modules = modulesFromFormValues(input as Record<string, unknown>)
  // Limits is the grant desk: what you tick becomes both granted and on.
  const nextFlags = {
    ...current,
    grantedModules: modules,
    modules,
  }

  const updated = await db.organization.update({
    where: { id: organization.id },
    data: {
      accessRestricted: input.accessRestricted,
      rentExpiresAt: input.rentExpiresAt ? new Date(input.rentExpiresAt) : null,
      maxUsers: input.maxUsers,
      rentNote: input.rentNote,
      featureFlags: nextFlags as unknown as Prisma.InputJsonValue,
    },
    select: {
      ...LIMIT_SELECT,
      _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
    },
  })

  const status = companyLimitStatus(updated)
  return {
    orgId: updated.id,
    name: updated.name,
    ...status,
    activeUsers: updated._count.memberships,
    modules: parseFeatureFlags(updated.featureFlags).modules,
  }
}

/** Confirm the user may open this company, then the client updates the session. */
export async function assertCanOpenCompany(ctx: OrgContext, orgId: string) {
  if (ctx.isSystemOwner) {
    const organization = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    })
    if (!organization) throw notFound('Company')
    return { orgId: organization.id, name: organization.name, role: 'OWNER' as const, membershipVersion: 0 }
  }

  if (!ctx.canConnect && orgId !== ctx.orgId) {
    throw forbidden('Connect is only available to an admin who has been allowed to switch companies.')
  }

  const membership = await db.membership.findUnique({
    where: { orgId_userId: { orgId, userId: ctx.userId } },
    select: {
      status: true,
      role: true,
      version: true,
      organization: {
        select: {
          id: true,
          name: true,
          accessRestricted: true,
          rentExpiresAt: true,
          maxUsers: true,
          rentNote: true,
        },
      },
    },
  })
  if (!membership || membership.status !== 'ACTIVE') {
    throw notFound('Company')
  }
  if (membership.organization.id !== orgId) throw forbidden()

  const limits = companyLimitStatus(membership.organization)
  if (limits.openBlocked) {
    throw forbidden(limits.blockReason ?? 'This company cannot be opened right now.')
  }

  return {
    orgId: membership.organization.id,
    name: membership.organization.name,
    role: membership.role,
    membershipVersion: membership.version,
  }
}

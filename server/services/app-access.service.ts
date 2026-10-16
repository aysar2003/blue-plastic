import 'server-only'

import type { Prisma } from '@prisma/client'

import {
  MODULE_FLAG_LABELS,
  MODULE_FLAGS,
  parseFeatureFlags,
  type ModuleFlag,
  type OrgFeatureFlags,
} from '@/lib/feature-flags'
import type { RequestAppsInput, ReviewAppAccessInput } from '@/lib/validation/app-access'
import { requestedModulesFromInput } from '@/lib/validation/app-access'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden, notFound, precondition, validation } from '@/server/errors'

function labelsFor(modules: Record<ModuleFlag, boolean>): string[] {
  return MODULE_FLAGS.filter((key) => modules[key]).map((key) => MODULE_FLAG_LABELS[key].label)
}

/**
 * Company staff ask the ERP system owner for apps beyond the current grant.
 * Only apps that are not already granted are stored on the request.
 */
export async function requestApps(ctx: OrgContext, input: RequestAppsInput) {
  if (!ctx.permissions.has('org:update')) {
    throw forbidden('Only a company admin can request apps.')
  }

  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { id: true, name: true, featureFlags: true },
  })
  if (!org) throw notFound('Organisation')

  const flags = parseFeatureFlags(org.featureFlags)
  const asked = requestedModulesFromInput(input)
  const needed = Object.fromEntries(
    MODULE_FLAGS.map((key) => [key, Boolean(asked[key] && !flags.grantedModules[key])]),
  ) as Record<ModuleFlag, boolean>

  if (!MODULE_FLAGS.some((key) => needed[key])) {
    throw validation('Those apps are already available for this company.')
  }

  const pending = await db.appAccessRequest.findFirst({
    where: { orgId: ctx.orgId, status: 'PENDING' },
    select: { id: true },
  })
  if (pending) {
    throw precondition('A request is already waiting. Wait for it to be reviewed, or cancel it first.')
  }

  const meta = await requestMeta()
  const row = await db.$transaction(async (tx) => {
    const created = await tx.appAccessRequest.create({
      data: {
        orgId: ctx.orgId,
        requestedModules: needed as unknown as Prisma.InputJsonValue,
        note: input.note ?? null,
        requestedById: ctx.userId,
      },
      select: {
        id: true,
        createdAt: true,
        note: true,
        requestedModules: true,
      },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'AppAccessRequest',
        entityId: created.id,
        action: 'CREATE',
        after: {
          apps: labelsFor(needed),
          note: input.note ?? null,
          organization: org.name,
        },
      },
      meta,
    )
    return created
  })

  return {
    id: row.id,
    apps: labelsFor(needed),
    note: row.note,
    at: row.createdAt,
  }
}

export async function listPendingForOwner(ctx: OrgContext) {
  if (!ctx.isSystemOwner) throw forbidden('Only the system owner can review app requests.')

  const rows = await db.appAccessRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      note: true,
      requestedModules: true,
      createdAt: true,
      organization: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  })

  return rows.map((row) => {
    const modules = parseModules(row.requestedModules)
    return {
      id: row.id,
      orgId: row.organization.id,
      orgName: row.organization.name,
      note: row.note,
      apps: labelsFor(modules),
      modules,
      at: row.createdAt,
      who: row.requestedBy.name,
      email: row.requestedBy.email,
    }
  })
}

export async function listForCompany(ctx: OrgContext) {
  const rows = await db.appAccessRequest.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      status: true,
      note: true,
      reviewNote: true,
      requestedModules: true,
      createdAt: true,
      reviewedAt: true,
    },
  })

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    note: row.note,
    reviewNote: row.reviewNote,
    apps: labelsFor(parseModules(row.requestedModules)),
    at: row.createdAt,
    reviewedAt: row.reviewedAt,
  }))
}

export async function cancelPending(ctx: OrgContext, id: string) {
  if (!ctx.permissions.has('org:update')) {
    throw forbidden('Only a company admin can cancel an app request.')
  }

  const row = await db.appAccessRequest.findFirst({
    where: { id, orgId: ctx.orgId, status: 'PENDING' },
    select: { id: true },
  })
  if (!row) throw notFound('App request')

  await db.appAccessRequest.delete({ where: { id: row.id } })
  return { id: row.id }
}

/**
 * System owner accepts or refuses. Approve merges the asked apps into both
 * grants and the company's on-map so they appear immediately.
 */
export async function review(ctx: OrgContext, input: ReviewAppAccessInput) {
  if (!ctx.isSystemOwner) throw forbidden('Only the system owner can review app requests.')

  const row = await db.appAccessRequest.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      orgId: true,
      status: true,
      requestedModules: true,
      organization: { select: { id: true, name: true, featureFlags: true } },
    },
  })
  if (!row) throw notFound('App request')
  if (row.status !== 'PENDING') throw precondition('That request was already reviewed.')

  const asked = parseModules(row.requestedModules)
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    if (input.decision === 'approve') {
      const current = parseFeatureFlags(row.organization.featureFlags)
      const grantedModules = { ...current.grantedModules }
      const modules = { ...current.modules }
      for (const key of MODULE_FLAGS) {
        if (asked[key]) {
          grantedModules[key] = true
          modules[key] = true
        }
      }
      const next: OrgFeatureFlags = { ...current, grantedModules, modules }
      await tx.organization.update({
        where: { id: row.orgId },
        data: { featureFlags: next as unknown as Prisma.InputJsonValue },
      })
    }

    const updated = await tx.appAccessRequest.update({
      where: { id: row.id },
      data: {
        status: input.decision === 'approve' ? 'APPROVED' : 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: ctx.userId,
        reviewNote: input.note ?? null,
      },
      select: { id: true, status: true },
    })

    await writeAudit(
      tx,
      ctx,
      {
        entity: 'AppAccessRequest',
        entityId: row.id,
        action: 'UPDATE',
        after: {
          decision: input.decision,
          apps: labelsFor(asked),
          organization: row.organization.name,
          note: input.note ?? null,
        },
      },
      meta,
    )

    return {
      id: updated.id,
      status: updated.status,
      orgId: row.orgId,
      orgName: row.organization.name,
      apps: labelsFor(asked),
    }
  })
}

function parseModules(raw: unknown): Record<ModuleFlag, boolean> {
  const modules = Object.fromEntries(MODULE_FLAGS.map((key) => [key, false])) as Record<
    ModuleFlag,
    boolean
  >
  if (!raw || typeof raw !== 'object') return modules
  const data = raw as Record<string, unknown>
  for (const key of MODULE_FLAGS) {
    if (typeof data[key] === 'boolean') modules[key] = data[key]
  }
  return modules
}

import 'server-only'

import type { Prisma } from '@prisma/client'

import { getPack, INDUSTRY_PACKS, type PackId } from '@/lib/packs'
import { can } from '@/server/auth/permissions'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden, notFound, validation } from '@/server/errors'
import * as packService from '@/server/services/pack.service'

function parseChecklistDone(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 80)
}

export type OnboardingState = {
  completed: boolean
  completedAt: string | null
  installedPackId: string | null
  packLabel: string | null
  checklistDone: string[]
  needsWizard: boolean
  packs: {
    id: PackId
    label: string
    blurb: string
    category: string
    verticalStatus: 'ready' | 'planned'
    modules: string[]
    checklist: { id: string; label: string; href: string }[]
    inScope: readonly string[]
    outOfScope: readonly string[]
  }[]
}

export async function getState(ctx: OrgContext): Promise<OnboardingState> {
  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: {
      installedPackId: true,
      onboardingCompletedAt: true,
      onboardingChecklistDone: true,
    },
  })
  if (!org) throw notFound('Organisation')

  const pack = org.installedPackId ? getPack(org.installedPackId) : null
  const completed = org.onboardingCompletedAt != null
  const canRun = can(ctx.role, 'org:update') || ctx.isSystemOwner

  return {
    completed,
    completedAt: org.onboardingCompletedAt?.toISOString() ?? null,
    installedPackId: org.installedPackId,
    packLabel: pack?.label ?? null,
    checklistDone: parseChecklistDone(org.onboardingChecklistDone),
    needsWizard: canRun && !completed,
    packs: INDUSTRY_PACKS.map((row) => ({
      id: row.id,
      label: row.label,
      blurb: row.blurb,
      category: row.category,
      verticalStatus: row.verticalStatus,
      modules: [...row.enabledModules],
      checklist: row.setupChecklist.map((item) => ({ ...item })),
      inScope: row.inScope,
      outOfScope: row.outOfScope,
    })),
  }
}

/** Finish wizard by installing the chosen institution pack. */
export async function complete(
  ctx: OrgContext,
  input: { packId: string; seedChart?: boolean },
) {
  if (!can(ctx.role, 'org:update') && !ctx.isSystemOwner) {
    throw forbidden('Only an admin can finish onboarding.')
  }
  const pack = getPack(input.packId)
  if (!pack) throw validation('Unknown industry pack.')
  if (pack.verticalStatus !== 'ready') {
    throw validation('That institution pack is not vertical-ready yet.')
  }

  // Wizard is an explicit institution choice — OWNER/ADMIN may set grants to the pack.
  const mayReplace =
    ctx.isSystemOwner || ctx.role === 'OWNER' || ctx.role === 'ADMIN'
  const result = await packService.installPack(ctx, pack.id, {
    seedChart: input.seedChart ?? pack.seedChartDefault,
    replaceGrants: mayReplace,
  })

  await db.organization.update({
    where: { id: ctx.orgId },
    data: { onboardingCompletedAt: new Date() },
  })

  return result
}

/** Skip pack install but mark onboarding done so the shell unlocks. */
export async function skip(ctx: OrgContext) {
  if (!can(ctx.role, 'org:update') && !ctx.isSystemOwner) {
    throw forbidden('Only an admin can skip onboarding.')
  }
  await db.organization.update({
    where: { id: ctx.orgId },
    data: { onboardingCompletedAt: new Date() },
  })
  return { skipped: true as const }
}

/** Re-open the wizard (Settings → Setup). */
export async function reopen(ctx: OrgContext) {
  if (!can(ctx.role, 'org:update') && !ctx.isSystemOwner) {
    throw forbidden('Only an admin can re-run onboarding.')
  }
  await db.organization.update({
    where: { id: ctx.orgId },
    data: { onboardingCompletedAt: null },
  })
  return { reopened: true as const }
}

export async function toggleChecklistItem(
  ctx: OrgContext,
  input: { itemId: string; done: boolean },
) {
  if (!can(ctx.role, 'org:update') && !ctx.isSystemOwner) {
    throw forbidden('Only an admin can update the setup checklist.')
  }
  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: { onboardingChecklistDone: true, installedPackId: true },
  })
  if (!org) throw notFound('Organisation')

  const pack = org.installedPackId ? getPack(org.installedPackId) : null
  const known = new Set(pack?.setupChecklist.map((item) => item.id) ?? [])
  if (pack && !known.has(input.itemId)) {
    throw validation('Unknown checklist item for the installed pack.')
  }

  const prior = new Set(parseChecklistDone(org.onboardingChecklistDone))
  if (input.done) prior.add(input.itemId)
  else prior.delete(input.itemId)
  const next = [...prior].sort()

  await db.organization.update({
    where: { id: ctx.orgId },
    data: { onboardingChecklistDone: next as unknown as Prisma.InputJsonValue },
  })
  return { checklistDone: next }
}

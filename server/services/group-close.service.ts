import 'server-only'

import { Decimal } from '@/lib/money'
import { normalizeOwnershipPercent } from '@/lib/erp/consolidation-ownership'
import {
  buildGroupCloseBlockers,
  isGroupCloseReady,
} from '@/lib/erp/group-close-gates'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { forbidden, validation } from '@/server/errors'
import {
  listGroupOrgIds,
  resolveGroupRootId,
} from '@/server/services/company-group.service'
import * as icMatch from '@/server/services/intercompany-match.service'

export type GroupCloseEntityRow = {
  orgId: string
  name: string
  baseCurrency: string
  ownershipPercent: string
  isParent: boolean
  periodStatus: 'OPEN' | 'CLOSED' | 'LOCKED' | 'MISSING'
  periodId: string | null
  periodLabel: string | null
}

export type GroupCloseChecklist = {
  rootOrgId: string
  asOf: string
  entities: GroupCloseEntityRow[]
  unmatchedIcCount: number
  currencyMismatch: boolean
  currencies: string[]
  ownershipIncomplete: boolean
  ready: boolean
  blockers: string[]
}

async function assertGroupAdmin(ctx: OrgContext): Promise<string> {
  if (ctx.role !== 'OWNER' && ctx.role !== 'ADMIN' && !ctx.isSystemOwner) {
    throw forbidden('Group admin required.')
  }
  const rootOrgId = await resolveGroupRootId(ctx.orgId, ctx.organization.parentOrgId)
  if (!ctx.isSystemOwner) {
    const mainMembership = await db.membership.findUnique({
      where: { orgId_userId: { orgId: rootOrgId, userId: ctx.userId } },
      select: { role: true, status: true },
    })
    const ok =
      mainMembership?.status === 'ACTIVE' &&
      (mainMembership.role === 'OWNER' || mainMembership.role === 'ADMIN')
    if (!ok) throw forbidden('Only a main-company admin can open the group close checklist.')
  }
  return rootOrgId
}

/**
 * Group close checklist for a calendar month (YYYY-MM) or a date whose month is used.
 * Looks up each entity's accounting period that contains `asOf`.
 */
export async function groupCloseChecklist(
  ctx: OrgContext,
  asOfInput?: string,
): Promise<GroupCloseChecklist> {
  const rootOrgId = await assertGroupAdmin(ctx)
  const asOf = (asOfInput?.trim() || new Date().toISOString().slice(0, 10)).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    throw validation('Use an as-of date as YYYY-MM-DD.')
  }
  const asOfDate = new Date(`${asOf}T00:00:00.000Z`)

  const orgIds = await listGroupOrgIds(rootOrgId)
  const companies = await db.organization.findMany({
    where: { id: { in: orgIds } },
    select: {
      id: true,
      name: true,
      baseCurrency: true,
      parentOrgId: true,
      ownershipPercent: true,
    },
    orderBy: { name: 'asc' },
  })

  const entities: GroupCloseEntityRow[] = []
  for (const company of companies) {
    const period = await db.accountingPeriod.findFirst({
      where: {
        orgId: company.id,
        startDate: { lte: asOfDate },
        endDate: { gte: asOfDate },
      },
      select: {
        id: true,
        status: true,
        periodNumber: true,
        startDate: true,
        endDate: true,
        fiscalYear: { select: { year: true } },
      },
    })

    entities.push({
      orgId: company.id,
      name: company.name,
      baseCurrency: company.baseCurrency,
      ownershipPercent: normalizeOwnershipPercent(
        company.parentOrgId ? company.ownershipPercent.toString() : '100',
      ).toFixed(4),
      isParent: company.id === rootOrgId,
      periodStatus: period ? period.status : 'MISSING',
      periodId: period?.id ?? null,
      periodLabel: period
        ? `${period.fiscalYear.year} P${period.periodNumber} (${period.startDate.toISOString().slice(0, 10)}–${period.endDate.toISOString().slice(0, 10)})`
        : null,
    })
  }

  // Parent first
  entities.sort((a, b) => {
    if (a.orgId === rootOrgId) return -1
    if (b.orgId === rootOrgId) return 1
    return a.name.localeCompare(b.name)
  })

  const unmatchedIcCount = await icMatch.countUnmatched(ctx)
  const currencies = [...new Set(entities.map((row) => row.baseCurrency))]
  const currencyMismatch = currencies.length > 1
  const ownershipIncomplete = entities.some(
    (row) =>
      !row.isParent && new Decimal(row.ownershipPercent).lessThanOrEqualTo(0),
  )

  const openOrMissing = entities.filter(
    (row) => row.periodStatus === 'OPEN' || row.periodStatus === 'MISSING',
  )
  const blockers = buildGroupCloseBlockers({
    openOrMissingCount: openOrMissing.length,
    unmatchedIcCount,
    currencyMismatch,
    currencies,
    ownershipIncomplete,
    asOf,
  })

  return {
    rootOrgId,
    asOf,
    entities,
    unmatchedIcCount,
    currencyMismatch,
    currencies,
    ownershipIncomplete,
    ready: isGroupCloseReady(blockers),
    blockers,
  }
}

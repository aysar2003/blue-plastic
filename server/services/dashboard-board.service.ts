import 'server-only'

import {
  DASHBOARD_KPI_KEYS,
  DASHBOARD_REPORT_KEYS,
  DASHBOARD_SPARK_KEYS,
  reportHref,
  thresholdBreached,
  tileTitle,
  type DashboardTileKind,
  type ResolvedTile,
} from '@/lib/erp/dashboard-board'
import type { HomeKpiKey } from '@/lib/dashboard-prefs'
import { startOfMonth, today } from '@/lib/date'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'
import * as businessOverview from '@/server/services/business-overview'
import * as erpHome from '@/server/services/erp-home.service'
import * as inventoryService from '@/server/services/inventory.service'

export type TileInput = {
  kind: DashboardTileKind
  refKey: string
  title?: string | null
  sortOrder?: number
  threshold?: string | null
}

function assertRef(kind: DashboardTileKind, refKey: string) {
  if (kind === 'KPI' && !DASHBOARD_KPI_KEYS.includes(refKey as HomeKpiKey)) {
    throw validation(`Unknown KPI tile: ${refKey}`)
  }
  if (kind === 'REPORT' && !(DASHBOARD_REPORT_KEYS as readonly string[]).includes(refKey)) {
    throw validation(`Unknown report tile: ${refKey}`)
  }
  if (kind === 'SPARK' && !(DASHBOARD_SPARK_KEYS as readonly string[]).includes(refKey)) {
    throw validation(`Unknown spark tile: ${refKey}`)
  }
}

export async function list(ctx: OrgContext) {
  assertPermission(ctx, 'report:read')
  return db.dashboard.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { tiles: true } } },
  })
}

export async function get(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'report:read')
  const row = await db.dashboard.findFirst({
    where: { id, orgId: ctx.orgId },
    include: { tiles: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!row) throw notFound('Dashboard')
  return row
}

export async function create(
  ctx: OrgContext,
  input: { name: string; description?: string | null; tiles: TileInput[] },
) {
  assertPermission(ctx, 'report:export')
  const name = input.name.trim()
  if (!name) throw validation('Name is required.')
  for (const tile of input.tiles) assertRef(tile.kind, tile.refKey)

  return db.dashboard.create({
    data: {
      orgId: ctx.orgId,
      name,
      description: input.description?.trim() || null,
      createdById: ctx.userId,
      tiles: {
        create: input.tiles.map((tile, index) => ({
          orgId: ctx.orgId,
          kind: tile.kind,
          refKey: tile.refKey,
          title: tile.title?.trim() || null,
          sortOrder: tile.sortOrder ?? index,
          threshold: tile.threshold?.trim() || null,
        })),
      },
    },
    select: { id: true, name: true },
  })
}

export async function remove(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'report:export')
  const row = await db.dashboard.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!row) throw notFound('Dashboard')
  await db.dashboard.delete({ where: { id: row.id } })
  return { id: row.id }
}

/** Resolve tile values from existing overview / home KPI builders. */
export async function resolveBoard(ctx: OrgContext, id: string): Promise<{
  id: string
  name: string
  description: string | null
  tiles: ResolvedTile[]
  banners: string[]
}> {
  assertPermission(ctx, 'report:overview')
  const board = await get(ctx, id)
  const monthKey = startOfMonth(today(ctx.organization.timeZone)).slice(0, 7)

  const [overview, extras, reorder] = await Promise.all([
    businessOverview.businessOverview(ctx, monthKey).catch(() => null),
    erpHome.homeExtras(ctx).catch(() => erpHome.extrasOrZero()),
    inventoryService.reorderReport(ctx).catch(() => []),
  ])

  const kpiValue = (key: string): string | null => {
    switch (key as HomeKpiKey) {
      case 'profitMtd':
        return overview?.profit.net ?? null
      case 'openAr':
        return overview?.invoices.unpaid ?? null
      case 'reorder':
        return String(reorder.length)
      case 'pipeline':
        return extras.pipelineAmount.toFixed(2)
      case 'unpaidAp':
        return extras.unpaidAp.toFixed(2)
      case 'followUps':
        return String(extras.followUps)
      default:
        return null
    }
  }

  const sparkValue = (key: string): string | null => {
    if (!overview) return null
    if (key === 'cashMovement') {
      const last = overview.cashMonths[overview.cashMonths.length - 1]
      return last?.amount ?? null
    }
    if (key === 'profitTrend') return overview.profit.change
    return null
  }

  const tiles: ResolvedTile[] = board.tiles.map((tile) => {
    const kind = tile.kind as DashboardTileKind
    let value: string | null = null
    let href: string | undefined
    if (kind === 'KPI') value = kpiValue(tile.refKey)
    else if (kind === 'SPARK') value = sparkValue(tile.refKey)
    else {
      value = 'Open'
      href = reportHref(tile.refKey)
    }
    const breached = thresholdBreached(
      value,
      tile.threshold != null ? tile.threshold.toString() : null,
    )
    return {
      kind,
      refKey: tile.refKey,
      title: tileTitle(kind, tile.refKey, tile.title),
      value,
      href,
      thresholdBreached: breached,
    }
  })

  const banners = tiles
    .filter((tile) => tile.thresholdBreached)
    .map((tile) => `${tile.title} is at or above its watch threshold (${tile.value}).`)

  return {
    id: board.id,
    name: board.name,
    description: board.description,
    tiles,
    banners,
  }
}

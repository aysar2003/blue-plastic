import 'server-only'

import { startOfMonth, today, toDate } from '@/lib/date'
import { Decimal } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as businessOverview from '@/server/services/business-overview'
import * as erpHome from '@/server/services/erp-home.service'
import * as inventoryService from '@/server/services/inventory.service'

export const SNAPSHOT_KEYS = [
  'profitMtd',
  'openAr',
  'unpaidAp',
  'pipeline',
  'reorder',
  'followUps',
  'cashMovement',
] as const

export type SnapshotKey = (typeof SNAPSHOT_KEYS)[number]

/** Capture today's KPI values from existing overview builders. */
export async function captureToday(ctx: OrgContext) {
  const day = today(ctx.organization.timeZone)
  const monthKey = startOfMonth(day).slice(0, 7)
  const [overview, extras, reorder] = await Promise.all([
    businessOverview.businessOverview(ctx, monthKey).catch(() => null),
    erpHome.homeExtras(ctx).catch(() => erpHome.extrasOrZero()),
    inventoryService.reorderReport(ctx).catch(() => []),
  ])

  const values: Record<SnapshotKey, string> = {
    profitMtd: overview?.profit.net ?? '0',
    openAr: overview?.invoices.unpaid ?? '0',
    unpaidAp: extras.unpaidAp,
    pipeline: extras.pipelineAmount,
    reorder: String(reorder.length),
    followUps: String(extras.followUps),
    cashMovement: overview?.cashMonths.at(-1)?.amount ?? '0',
  }

  for (const [metricKey, value] of Object.entries(values)) {
    await db.metricSnapshot.upsert({
      where: {
        orgId_date_metricKey: {
          orgId: ctx.orgId,
          date: toDate(day),
          metricKey,
        },
      },
      create: {
        orgId: ctx.orgId,
        date: toDate(day),
        metricKey,
        value: new Decimal(value).toFixed(4),
      },
      update: { value: new Decimal(value).toFixed(4) },
    })
  }

  return { date: day, keys: Object.keys(values).length }
}

export async function series(
  ctx: OrgContext,
  metricKey: SnapshotKey,
  days = 14,
): Promise<{ date: string; value: string }[]> {
  const rows = await db.metricSnapshot.findMany({
    where: { orgId: ctx.orgId, metricKey },
    orderBy: { date: 'desc' },
    take: days,
    select: { date: true, value: true },
  })
  return rows
    .map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      value: row.value.toString(),
    }))
    .reverse()
}

/** Cron: snapshot every org that has report:overview capable users — here all orgs. */
export async function captureAllOrgs() {
  const orgs = await db.organization.findMany({
    select: { id: true, timeZone: true, baseCurrency: true },
    take: 500,
  })
  let ok = 0
  for (const org of orgs) {
    const ctx = {
      orgId: org.id,
      userId: 'cron',
      organization: org,
      permissions: new Set(['report:overview', 'inventory:read']),
    } as unknown as OrgContext
    try {
      await captureToday(ctx)
      ok += 1
    } catch {
      // Continue other orgs.
    }
  }
  return { orgs: orgs.length, ok }
}

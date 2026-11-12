import type { Metadata } from 'next'
import Link from 'next/link'

import { AppLauncher } from '@/components/layout/app-launcher'
import { HomeKpiCards } from '@/components/layout/home-kpi-cards'
import { HomePins } from '@/components/layout/home-pins'
import { appsForPermissions } from '@/components/layout/launcher-apps'
import { HomeKpiPrefsForm } from '@/components/layout/home-kpi-prefs-form'
import { TeamDayPath, friendlyFirstName } from '@/components/layout/team-day-path'
import { parseDashboardPrefs, resolvedKpiPins } from '@/lib/dashboard-prefs'
import { startOfMonth, today } from '@/lib/date'
import { isModuleEnabled } from '@/lib/feature-flags'
import { formatQty } from '@/lib/quantity'
import { requireOrgContext } from '@/server/auth/context'
import * as inventoryService from '@/server/services/inventory.service'
import * as businessOverview from '@/server/services/business-overview'
import { db } from '@/server/db'
import * as workspace from '@/server/services/workspace.service'
import * as erpHome from '@/server/services/erp-home.service'

export const metadata: Metadata = { title: 'Apps' }

/** Home is the app launcher. Company databases live in the Databases app. */
export default async function DashboardPage() {
  const ctx = await requireOrgContext()
  const apps = appsForPermissions(ctx.permissions).filter((app) => isModuleEnabled(ctx.features, app.key))
  const first = friendlyFirstName(ctx.user.name)
  const showReorder =
    isModuleEnabled(ctx.features, 'inventory') && ctx.permissions.has('inventory:read')
  const showKpis = ctx.permissions.has('report:overview')
  const monthKey = startOfMonth(today(ctx.organization.timeZone)).slice(0, 7)

  const [bookmarks, stockAlerts, kpis, userPrefs, extras] = await Promise.all([
    workspace.listBookmarks(ctx),
    showReorder
      ? inventoryService.listStockAlerts(ctx).catch(() => ({ total: 0, alerts: [] }))
      : Promise.resolve({ total: 0, alerts: [] as Awaited<ReturnType<typeof inventoryService.listStockAlerts>>['alerts'] }),
    showKpis
      ? businessOverview.homeKpis(ctx, monthKey).catch(() => null)
      : Promise.resolve(null),
    db.user
      .findUnique({ where: { id: ctx.userId }, select: { dashboardPrefs: true } })
      .catch(() => null),
    showKpis ? erpHome.homeExtras(ctx).catch(() => erpHome.extrasOrZero()) : Promise.resolve(erpHome.extrasOrZero()),
  ])
  const kpiPins = resolvedKpiPins(parseDashboardPrefs(userPrefs?.dashboardPrefs))
  const pins = bookmarks.filter((item) => item.kind === 'pin')
  const reorder = stockAlerts.alerts

  return (
    <>
      <TeamDayPath />
      {pins.length > 0 ? (
        <div className="mx-auto w-full px-[clamp(0.75rem,2vw,2.5rem)] pt-6">
          <HomePins pins={pins} />
        </div>
      ) : null}
      {showKpis ? (
        <div className="mx-auto w-full px-[clamp(0.75rem,2vw,2.5rem)] pt-4">
          <HomeKpiPrefsForm pinned={kpiPins} />
        </div>
      ) : null}
      <HomeKpiCards
        currency={ctx.organization.baseCurrency}
        profitMtd={kpis?.profitNet ?? null}
        openAr={kpis?.openAr ?? null}
        reorderCount={showReorder ? stockAlerts.total : null}
        pipelineAmount={extras.pipelineAmount}
        pipelineCount={extras.pipelineCount}
        unpaidAp={extras.unpaidAp}
        followUps={extras.followUps}
        pinnedKeys={kpiPins}
      />
      {reorder.length > 0 ? (
        <div className="mx-auto w-full px-[clamp(0.75rem,2vw,2.5rem)] pt-6">
          <div className="rounded-lg border bg-card px-4 py-3">
            <Link href="/reports/inventory-reorder" className="text-sm font-medium hover:underline">
              {`Store: products to reorder (${stockAlerts.total})`}
            </Link>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {reorder.slice(0, 5).map((item) => (
                <li key={item.itemId}>
                  {item.name}
                  {' — '}
                  {formatQty(item.quantity, item.unitOfMeasure)} on hand
                  {item.reorderPoint
                    ? ` · reorder at ${formatQty(item.reorderPoint, item.unitOfMeasure)}`
                    : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <AppLauncher
        eyebrow={ctx.organization.name}
        title={first ? `Welcome back, ${first}` : 'Welcome back'}
        subtitle="Pick your job below — or use the team path above if you are new."
        apps={apps}
      />
    </>
  )
}

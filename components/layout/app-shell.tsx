import { Suspense } from 'react'

import { isModuleEnabled } from '@/lib/feature-flags'
import { ROLE_LABELS } from '@/lib/roles'
import type { OrgContext } from '@/server/auth/context'
import { LAUNCHER_APPS } from './launcher-apps'
import { MonthChartLoader } from './month-chart-loader'
import { MODULES } from './nav-items'
import { ShellChrome } from './shell-chrome'

/**
 * A Server Component. Permission filtering happens here, once, and the client
 * chrome receives only what this user may see — a hidden link is a convenience,
 * but the list it is hidden from is computed on the server.
 *
 * Stock and balance bells stream in via Suspense so page content is not blocked
 * on those queries; each loader is also short-cached per organisation.
 */
export async function AppShell({
  ctx,
  children,
  stockAlertsSlot = null,
  balanceAlertsSlot = null,
}: {
  ctx: OrgContext
  children: React.ReactNode
  stockAlertsSlot?: React.ReactNode
  balanceAlertsSlot?: React.ReactNode
}) {
  const modules = MODULES.filter(
    (entry) =>
      isModuleEnabled(ctx.features, entry.key) &&
      (!entry.permission || ctx.permissions.has(entry.permission)),
  )
  const moduleKeys = modules.map((entry) => entry.key)
  const permissions = [...ctx.permissions]
  // Apps switched off in Settings → Configuration. Plain strings, not a filter
  // function: this crosses into a client component.
  const hiddenApps = LAUNCHER_APPS.filter((app) => !isModuleEnabled(ctx.features, app.key)).map(
    (app) => app.key,
  )

  return (
    <ShellChrome
      orgName={ctx.organization.name}
      organization={ctx.organization}
      baseCurrency={ctx.organization.baseCurrency}
      fiscalYearStartMonth={ctx.organization.fiscalYearStartMonth}
      roleLabel={ROLE_LABELS[ctx.role]}
      user={ctx.user}
      moduleKeys={moduleKeys}
      permissions={permissions}
      hiddenApps={hiddenApps}
      showCreatorBrand={ctx.features.showCreatorBrand}
      stockAlertsSlot={stockAlertsSlot}
      balanceAlertsSlot={balanceAlertsSlot}
      monthChartSlot={
        ctx.permissions.has('report:read') ? (
          <Suspense fallback={null}>
            <MonthChartLoader ctx={ctx} />
          </Suspense>
        ) : null
      }
    >
      {children}
    </ShellChrome>
  )
}

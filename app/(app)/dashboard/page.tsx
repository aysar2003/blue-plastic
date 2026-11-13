import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { HomePins } from '@/components/layout/home-pins'
import { appsForPermissions, orderHomeApps } from '@/components/layout/launcher-apps'
import { friendlyFirstName } from '@/components/layout/team-day-path'
import { isModuleEnabled } from '@/lib/feature-flags'
import { requireOrgContext } from '@/server/auth/context'
import * as workspace from '@/server/services/workspace.service'

export const metadata: Metadata = { title: 'Apps' }

/**
 * Apps home — Odoo-style flat icon grid.
 * Only apps turned ON for this company appear here, related ones side by side.
 * Apps that are off are managed in Settings → Apps & features (like Odoo Apps).
 */
export default async function DashboardPage() {
  const ctx = await requireOrgContext()
  const apps = orderHomeApps(
    appsForPermissions(ctx.permissions, { includeNested: true }).filter((app) =>
      isModuleEnabled(ctx.features, app.key),
    ),
  )
  const first = friendlyFirstName(ctx.user.name)
  const bookmarks = await workspace.listBookmarks(ctx).catch(() => [])
  const pins = bookmarks.filter((item) => item.kind === 'pin')
  const canManageApps = ctx.permissions.has('org:update')

  return (
    <>
      {pins.length > 0 ? (
        <div className="mx-auto w-full px-[clamp(0.75rem,2vw,2.5rem)] pt-6">
          <HomePins pins={pins} />
        </div>
      ) : null}
      <AppLauncher
        eyebrow={ctx.organization.name}
        title={first ? `Welcome back, ${first}` : 'Apps'}
        subtitle=""
        apps={apps}
        homeMenu
        manageAppsHref={canManageApps ? '/settings/features' : undefined}
      />
    </>
  )
}

import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { HomePins } from '@/components/layout/home-pins'
import {
  appsForPermissions,
  orderHomeApps,
} from '@/components/layout/launcher-apps'
import { friendlyFirstName } from '@/components/layout/team-day-path'
import { GettingStartedHome } from '@/components/onboarding/getting-started-home'
import { isModuleEnabled } from '@/lib/feature-flags'
import {
  getPack,
  orderHomeAppsForPack,
  primaryHubForPack,
  verticalLauncherVisible,
} from '@/lib/packs'
import { can } from '@/server/auth/permissions'
import { requireOrgContext } from '@/server/auth/context'
import * as onboardingService from '@/server/services/onboarding.service'
import * as workspace from '@/server/services/workspace.service'

export const metadata: Metadata = { title: 'Apps' }

/**
 * Apps home — flat icon grid. Pack-aware order puts the industry desk first.
 * Getting started uses the installed pack checklist until complete.
 */
export default async function DashboardPage() {
  const ctx = await requireOrgContext()
  const [onboarding, bookmarks] = await Promise.all([
    onboardingService.getState(ctx),
    workspace.listBookmarks(ctx).catch(() => []),
  ])

  const packId = ctx.organization.installedPackId ?? onboarding.installedPackId
  const pack = packId ? getPack(packId) : null

  const apps = orderHomeAppsForPack(
    appsForPermissions(ctx.permissions, { includeNested: true }).filter((app) => {
      if (!isModuleEnabled(ctx.features, app.key)) return false
      return verticalLauncherVisible(app.key, packId)
    }),
    packId,
    orderHomeApps,
  )

  const first = friendlyFirstName(ctx.user.name)
  const pins = bookmarks.filter((item) => item.kind === 'pin')
  const canManageApps = ctx.permissions.has('org:update')
  const canEditSetup = can(ctx.role, 'org:update') || ctx.isSystemOwner

  const checklistDone = new Set(onboarding.checklistDone)
  const showGettingStarted =
    pack != null && pack.setupChecklist.some((item) => !checklistDone.has(item.id))

  const hub = pack ? primaryHubForPack(pack.id) : null

  return (
    <>
      {showGettingStarted && pack && hub ? (
        <GettingStartedHome
          title={`Set up your ${pack.label.toLowerCase()}`}
          blurb={pack.blurb}
          hubHref={hub.href}
          hubLabel={hub.label}
          items={pack.setupChecklist.map((item) => ({ ...item }))}
          doneIds={onboarding.checklistDone}
          canEdit={canEditSetup}
        />
      ) : null}
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

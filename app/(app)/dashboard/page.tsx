import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { HomePins } from '@/components/layout/home-pins'
import { appsForPermissions } from '@/components/layout/launcher-apps'
import { requireOrgContext } from '@/server/auth/context'
import * as workspace from '@/server/services/workspace.service'

export const metadata: Metadata = { title: 'Apps' }

/**
 * Home is the app launcher. The month's money figures live on the Accounting
 * overview, so this page stays a grid of apps.
 */
export default async function DashboardPage() {
  const ctx = await requireOrgContext()
  const apps = appsForPermissions(ctx.permissions)
  const first = ctx.user.name.split(' ')[0] || ctx.user.name
  const bookmarks = await workspace.listBookmarks(ctx)
  const pins = bookmarks.filter((item) => item.kind === 'pin')

  return (
    <>
      {pins.length > 0 ? (
        <div className="mx-auto w-full px-[clamp(0.75rem,2vw,2.5rem)] pt-8">
          <HomePins pins={pins} />
        </div>
      ) : null}
      <AppLauncher
        eyebrow={ctx.organization.name}
        title={`Welcome back, ${first}`}
        subtitle="Choose an app to open the books."
        apps={apps}
      />
    </>
  )
}

import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { appsForPermissions } from '@/components/layout/launcher-apps'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Apps' }

/**
 * The home screen is an app launcher, not a report. Figures live inside the
 * modules; this page only asks which door to open.
 */
export default async function DashboardPage() {
  const ctx = await requireOrgContext()
  const apps = appsForPermissions(ctx.permissions)

  return (
    <AppLauncher
      apps={apps}
      orgName={ctx.organization.name}
      userName={ctx.user.name}
    />
  )
}

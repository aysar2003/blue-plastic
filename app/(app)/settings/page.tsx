import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { SETTINGS_HUB_APPS, visibleHubApps } from '@/components/layout/module-hubs'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsHubPage() {
  const ctx = await requireOrgContext('org:read')
  const apps = visibleHubApps(SETTINGS_HUB_APPS, ctx.permissions)

  return (
    <AppLauncher
      eyebrow={ctx.organization.name}
      title="Settings"
      subtitle="Organisation, accounts the system posts to, payment terms, tax, users, appearance, your profile, a backup of the books, and the activity log."
      apps={apps}
    />
  )
}

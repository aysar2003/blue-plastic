import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import {
  SETTINGS_HUB_APPS,
  SETTINGS_HUB_SECTIONS,
  visibleHubApps,
} from '@/components/layout/module-hubs'
import { PRODUCT_NAME } from '@/lib/product-brand'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Settings' }

/**
 * Settings Control Center — configure the current company only.
 * Each company on SOM ERP has its own features, users, tax, and books.
 */
export default async function SettingsHubPage() {
  const ctx = await requireOrgContext('org:read')
  const apps = visibleHubApps(SETTINGS_HUB_APPS, ctx.permissions)
  const byKey = new Map(apps.map((app) => [app.key, app]))
  const sections = SETTINGS_HUB_SECTIONS.map((section) => ({
    label: section.label,
    blurb: section.blurb,
    apps: section.keys.map((key) => byKey.get(key)).filter((app): app is NonNullable<typeof app> => Boolean(app)),
  })).filter((section) => section.apps.length > 0)

  return (
    <AppLauncher
      eyebrow={ctx.organization.name}
      title="Settings"
      subtitle={`${PRODUCT_NAME} control center for this company — apps, accounting setup, people, and data. Changes here do not affect other companies.`}
      sections={sections}
      searchable
    />
  )
}

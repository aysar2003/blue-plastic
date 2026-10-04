import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { HELP_HUB_APPS } from '@/components/layout/module-hubs'
import { requireOrgContext } from '@/server/auth/context'

export const metadata: Metadata = { title: 'Help' }

export default async function HelpHubPage() {
  const ctx = await requireOrgContext()

  return (
    <AppLauncher
      eyebrow={ctx.organization.name}
      title="Help"
      subtitle="How the books are meant to be used, and why the ledger behaves as it does."
      apps={HELP_HUB_APPS}
    />
  )
}

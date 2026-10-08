import type { Metadata } from 'next'

import { FeaturesForm } from './features-form'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'

export const metadata: Metadata = { title: 'Configuration' }

export default async function FeaturesSettingsPage() {
  await requireOrgContext('org:update')
  const ctx = await requireOrgContext('org:read')
  const flags = await organizationService.getFeatureFlags(ctx)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Configuration</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn features on or off for the whole organisation — the same idea as Odoo settings.
          Deletes stay soft (rows remain in the database; balances and lists exclude them).
        </p>
      </div>
      <FeaturesForm flags={flags} />
    </div>
  )
}

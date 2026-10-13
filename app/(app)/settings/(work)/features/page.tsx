import type { Metadata } from 'next'
import Link from 'next/link'

import { FeaturesForm } from './features-form'
import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'

export const metadata: Metadata = { title: 'Apps & features' }

export default async function FeaturesSettingsPage() {
  await requireOrgContext('org:update')
  const ctx = await requireOrgContext('org:read')
  const flags = await organizationService.getFeatureFlags(ctx)
  const canManageUsers = ctx.permissions.has('user:read')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Apps & features</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Company settings for <span className="font-medium text-foreground">{ctx.organization.name}</span>{' '}
          only — not the ERP system Limits under Databases. Other companies keep their own apps. Tax
          on/off lives under{' '}
          <Link href="/settings/tax" className="font-medium text-primary underline">
            Settings → Tax
          </Link>
          . To open apps for one person inside this company, use{' '}
          {canManageUsers ? (
            <Link href="/settings/users" className="font-medium text-primary underline">
              Settings → Users
            </Link>
          ) : (
            'Settings → Users'
          )}
          . Deletes stay soft (rows remain; balances and lists exclude them).
        </p>
      </div>
      <FeaturesForm flags={flags} />
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'

import { FeaturesForm } from './features-form'
import { requireOrgContext } from '@/server/auth/context'
import * as appAccessService from '@/server/services/app-access.service'
import * as organizationService from '@/server/services/organization.service'

export const metadata: Metadata = { title: 'Apps & features' }

export default async function FeaturesSettingsPage() {
  await requireOrgContext('org:update')
  const ctx = await requireOrgContext('org:read')
  const [flags, requests] = await Promise.all([
    organizationService.getFeatureFlags(ctx),
    appAccessService.listForCompany(ctx),
  ])
  const canManageUsers = ctx.permissions.has('user:read')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Apps & features</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Company settings for <span className="font-medium text-foreground">{ctx.organization.name}</span>{' '}
          only — expand each app to manage nested features and document types. Tax on/off lives
          under{' '}
          <Link href="/settings/tax" className="font-medium text-primary underline">
            Settings → Tax
          </Link>
          . Per-person access is under{' '}
          {canManageUsers ? (
            <Link href="/settings/users" className="font-medium text-primary underline">
              Settings → Company users
            </Link>
          ) : (
            'Settings → Company users'
          )}
          .
        </p>
      </div>
      <FeaturesForm
        flags={flags}
        canManageUsers={canManageUsers}
        requests={requests.map((row) => ({
          id: row.id,
          status: row.status,
          apps: row.apps,
          note: row.note,
          reviewNote: row.reviewNote,
          at: row.at.toISOString(),
        }))}
      />
    </div>
  )
}

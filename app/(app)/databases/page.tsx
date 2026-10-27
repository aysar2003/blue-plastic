import type { Metadata } from 'next'
import Link from 'next/link'

import { requireOrgContext } from '@/server/auth/context'
import * as appAccessService from '@/server/services/app-access.service'
import { listUserDatabases } from '@/server/services/backup-import.service'
import * as platformBilling from '@/server/services/platform-billing.service'
import { listPendingSignupRequests } from '@/server/services/register.service'

import { DatabasesBoard } from './databases-board'
import { PendingAppRequests } from './pending-app-requests'
import { PendingRentPayments } from './pending-rent-payments'
import { PendingSignups } from './pending-signups'

export const metadata: Metadata = { title: 'My databases' }

/**
 * Database home: list every company, connect into its books, create or restore.
 * System owners also review public /register requests here.
 */
export default async function DatabasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('org:update')
  const params = await searchParams
  const databases = await listUserDatabases(ctx)
  const pendingSignups = ctx.isSystemOwner ? await listPendingSignupRequests(ctx) : []
  const pendingAppRequests = ctx.isSystemOwner ? await appAccessService.listPendingForOwner(ctx) : []
  const pendingRentPayments = ctx.isSystemOwner
    ? await platformBilling.listPendingRentPayments(ctx)
    : []
  const panel =
    params.create === '1' ? 'create' : params.import === '1' ? 'import' : null
  const limitsOrgId = typeof params.limits === 'string' ? params.limits : null

  return (
    <div className="space-y-6">
      {ctx.isSystemOwner ? (
        <PendingAppRequests
          timeZone={ctx.organization.timeZone}
          requests={pendingAppRequests.map((row) => ({
            ...row,
            at: row.at.toISOString(),
          }))}
        />
      ) : null}
      {ctx.isSystemOwner ? <PendingRentPayments payments={pendingRentPayments} /> : null}
      {ctx.isSystemOwner ? <PendingSignups requests={pendingSignups} /> : null}
      {ctx.isSystemOwner ? (
        <p className="text-sm text-muted-foreground">
          <Link href="/databases/users" className="font-medium text-primary underline">
            System users
          </Link>
          {' · '}
          <Link href="/databases/billing" className="font-medium text-primary underline">
            Platform billing
          </Link>
          {' — '}
          plans, pay-to numbers, and every staff login across companies.
        </p>
      ) : null}
      <DatabasesBoard
        databases={databases}
        isSystemOwner={ctx.isSystemOwner}
        canConnect={ctx.canConnect}
        initialPanel={panel}
        initialLimitsOrgId={limitsOrgId}
      />
    </div>
  )
}

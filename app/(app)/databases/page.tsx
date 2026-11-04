import type { Metadata } from 'next'

import { requireOrgContext } from '@/server/auth/context'
import * as appAccessService from '@/server/services/app-access.service'
import { listUserDatabases } from '@/server/services/backup-import.service'
import * as platformBilling from '@/server/services/platform-billing.service'
import { listPendingSignupRequests } from '@/server/services/register.service'

import { DatabasesBoard } from './databases-board'
import { PendingAppRequests } from './pending-app-requests'
import { PendingRentPayments } from './pending-rent-payments'
import { PendingSignups } from './pending-signups'
import { PlatformConsoleHome } from './platform-console-home'

export const metadata: Metadata = { title: 'Platform console' }

/**
 * Database home: list every company, connect into its books, create or restore.
 * System owners see the Platform Console chrome + ops strip here.
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
        <PlatformConsoleHome
          companyCount={databases.length}
          pendingSignups={pendingSignups.length}
          pendingRent={pendingRentPayments.length}
          pendingAppRequests={pendingAppRequests.length}
        />
      ) : null}

      {ctx.isSystemOwner ? (
        <div id="pending-apps" className="scroll-mt-6">
          <PendingAppRequests
            timeZone={ctx.organization.timeZone}
            requests={pendingAppRequests.map((row) => ({
              ...row,
              at: row.at.toISOString(),
            }))}
          />
        </div>
      ) : null}
      {ctx.isSystemOwner ? (
        <div id="pending-rent" className="scroll-mt-6">
          <PendingRentPayments payments={pendingRentPayments} />
        </div>
      ) : null}
      {ctx.isSystemOwner ? (
        <div id="pending-signups" className="scroll-mt-6">
          <PendingSignups requests={pendingSignups} />
        </div>
      ) : null}

      <section className="space-y-3">
        {ctx.isSystemOwner ? (
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Companies</h2>
              <p className="text-xs text-muted-foreground">
                Open books to work inside a company. Limits and delete stay on this console.
              </p>
            </div>
          </div>
        ) : null}
        <DatabasesBoard
          databases={databases}
          isSystemOwner={ctx.isSystemOwner}
          canConnect={ctx.canConnect}
          initialPanel={panel}
          initialLimitsOrgId={limitsOrgId}
        />
      </section>
    </div>
  )
}

import type { Metadata } from 'next'

import { requireOrgContext } from '@/server/auth/context'
import { listUserDatabases } from '@/server/services/backup-import.service'
import { listPendingSignupRequests } from '@/server/services/register.service'

import { DatabasesBoard } from './databases-board'
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
  const panel =
    params.create === '1' ? 'create' : params.import === '1' ? 'import' : null

  return (
    <div className="space-y-6">
      {ctx.isSystemOwner ? <PendingSignups requests={pendingSignups} /> : null}
      <DatabasesBoard
        databases={databases}
        isSystemOwner={ctx.isSystemOwner}
        canConnect={ctx.canConnect}
        initialPanel={panel}
      />
    </div>
  )
}

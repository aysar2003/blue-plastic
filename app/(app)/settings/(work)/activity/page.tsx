import type { Metadata } from 'next'

import { QueryProvider } from '@/components/providers/query-provider'
import { requireOrgContext } from '@/server/auth/context'
import { ActivityList } from './activity-list'

export const metadata: Metadata = { title: 'Activity log' }

export default async function ActivityPage() {
  const ctx = await requireOrgContext('audit:read')

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every change made in this organisation, with who made it and when. Entries are written inside the
        same transaction as the change, so this list cannot fall behind the data.
      </p>
      <QueryProvider>
        <ActivityList timeZone={ctx.organization.timeZone} />
      </QueryProvider>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { ActivityIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { parsePerformanceDays } from '@/lib/user-performance'
import { requireOrgContext } from '@/server/auth/context'
import * as platformActivityService from '@/server/services/platform-activity.service'
import { PlatformActivityWorkspace } from './platform-activity-workspace'

export const metadata: Metadata = { title: 'Platform activity' }

export default async function PlatformActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('org:update')
  if (!ctx.isSystemOwner) redirect('/databases')

  const params = await searchParams
  const daysRaw = Array.isArray(params.days) ? params.days[0] : params.days
  const days = parsePerformanceDays(daysRaw)

  const snapshot = await platformActivityService.getPlatformActivity(ctx, {
    days,
    eventLimit: 80,
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity"
        description="Tenant insights: usage, user motion, security signals, feature adoption, and attention risks across the installation."
      />
      <p className="-mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Link href="/databases" className="font-medium text-primary hover:underline">
          Console
        </Link>
        <Link href="/databases/users" className="font-medium text-primary hover:underline">
          System users
        </Link>
        <Link href="/databases/billing" className="font-medium text-primary hover:underline">
          Platform billing
        </Link>
      </p>

      {snapshot.companies.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No companies yet"
          description="Create or import a company to start tracking usage and activity."
        />
      ) : (
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-slate-200/50 dark:bg-white/5" />}>
          <PlatformActivityWorkspace
            days={snapshot.days}
            totals={snapshot.totals}
            insights={snapshot.insights}
            daily={snapshot.daily}
            actionMix={snapshot.actionMix}
            entityMix={snapshot.entityMix}
            featureAdoption={snapshot.featureAdoption}
            suspiciousIps={snapshot.suspiciousIps}
            attention={snapshot.attention}
            companies={snapshot.companies}
            users={snapshot.users}
            events={snapshot.events}
          />
        </Suspense>
      )}
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { TrendingUpIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { parsePerformanceDays } from '@/lib/user-performance'
import { requireOrgContext } from '@/server/auth/context'
import * as userPerformanceService from '@/server/services/user-performance.service'
import {
  UserPerformanceWorkspace,
  type PerformanceDetail,
  type PerformanceListRow,
} from './user-performance-workspace'

export const metadata: Metadata = { title: 'Team performance' }

export default async function UserPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('user:read')
  const params = await searchParams
  const daysRaw = Array.isArray(params.days) ? params.days[0] : params.days
  const userRaw = Array.isArray(params.user) ? params.user[0] : params.user
  const days = parsePerformanceDays(daysRaw)
  const selectedUserId = userRaw?.trim() || null

  const { rows } = await userPerformanceService.listTeamPerformance(ctx, { days })

  const listRows: PerformanceListRow[] = rows.map((row) => ({
    userId: row.userId,
    membershipId: row.membershipId,
    name: row.name,
    email: row.email,
    roleLabel: row.roleLabel,
    score: row.score,
    band: row.band,
    rank: row.rank,
    activeDays: row.activeDays,
    workActions: row.workActions,
    counts: row.counts,
    lastActiveLabel: row.lastActiveLabel,
  }))

  let selected: PerformanceDetail | null = null
  const base = selectedUserId ? rows.find((r) => r.userId === selectedUserId) : null
  if (base) {
    const detail = await userPerformanceService.getPersonActivity(ctx, base.userId, { days })
    selected = {
      userId: base.userId,
      membershipId: base.membershipId,
      name: base.name,
      email: base.email,
      roleLabel: base.roleLabel,
      score: base.score,
      band: base.band,
      rank: base.rank,
      activeDays: base.activeDays,
      workActions: base.workActions,
      counts: base.counts,
      lastActiveLabel: base.lastActiveLabel,
      activity: detail.activity.map((item) => ({
        id: item.id,
        atLabel: item.atLabel,
        actionLabel: item.actionLabel,
        entityLabel: item.entityLabel,
        detail: item.detail,
      })),
      breakdown: detail.breakdown,
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team performance"
        description="See who is getting work done — ranked from recorded activity, not clock hours."
      />
      <p className="-mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Link href="/settings/users" className="font-medium text-primary hover:underline">
          Company users
        </Link>
        <Link href="/settings/user-history" className="font-medium text-primary hover:underline">
          User history
        </Link>
      </p>

      {listRows.length === 0 ? (
        <EmptyState
          icon={TrendingUpIcon}
          title="No team members yet"
          description="Add people under Company users to start seeing performance."
        />
      ) : (
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-muted/40" />}>
          <UserPerformanceWorkspace days={days} rows={listRows} selected={selected} />
        </Suspense>
      )}
    </div>
  )
}

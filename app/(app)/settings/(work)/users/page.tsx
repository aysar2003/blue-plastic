import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { UsersIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { parsePerformanceDays } from '@/lib/user-performance'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import { ASSIGNABLE_ROLES } from '@/lib/roles'
import { permissionsFor } from '@/server/auth/permissions'
import * as membershipService from '@/server/services/membership.service'
import * as userPerformanceService from '@/server/services/user-performance.service'
import { InviteUserDialog } from './invite-user-dialog'
import { mapMemberRow } from './map-member-row'
import { UsersWorkspace } from './users-workspace'

const ROLE_TEMPLATES = Object.fromEntries(
  ASSIGNABLE_ROLES.map((role) => [role, [...permissionsFor(role)]]),
) as Record<string, string[]>

export const metadata: Metadata = { title: 'Company users' }

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('user:read')
  const params = await searchParams
  const query = parseListQuery(params)
  const memberRaw = params.member
  const selectedId = (Array.isArray(memberRaw) ? memberRaw[0] : memberRaw)?.trim() || null
  const daysRaw = params.days
  const days = parsePerformanceDays(Array.isArray(daysRaw) ? daysRaw[0] : daysRaw)
  const [{ rows: members, total }, performanceByUserId] = await Promise.all([
    membershipService.list(ctx, query),
    userPerformanceService.performanceSummaryByUserId(ctx, days),
  ])

  const canInvite = ctx.permissions.has('user:invite')
  const canUpdate = ctx.permissions.has('user:update')
  const canRemove = ctx.permissions.has('user:remove')

  const rows = members
    .slice()
    .sort((a, b) => a.user.name.localeCompare(b.user.name))
    .map((member) => mapMemberRow(member, ctx, canUpdate, canRemove))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Company users"
        description="Select a member to manage profile, role, apps, status, and security."
        actions={
          canInvite ? (
            <InviteUserDialog roles={[...ASSIGNABLE_ROLES]} roleTemplates={ROLE_TEMPLATES} />
          ) : undefined
        }
      />
      <p className="-mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {ctx.isSystemOwner ? (
          <Link href="/databases/users" className="font-medium text-primary hover:underline">
            System users
          </Link>
        ) : null}
        {ctx.permissions.has('org:update') ? (
          <Link href="/settings/features" className="font-medium text-primary hover:underline">
            Configuration
          </Link>
        ) : null}
        <Link href="/settings/user-performance" className="font-medium text-primary hover:underline">
          Team performance
        </Link>
        <Link href="/settings/user-history" className="font-medium text-primary hover:underline">
          User history
        </Link>
      </p>

      {total === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={query.q ? 'No members match that search' : 'No members yet'}
          description={
            query.q
              ? 'Try a different name or email address.'
              : 'Add the people who need access and choose which apps they may open.'
          }
          action={
            canInvite && !query.q ? (
              <InviteUserDialog roles={[...ASSIGNABLE_ROLES]} roleTemplates={ROLE_TEMPLATES} />
            ) : undefined
          }
        />
      ) : (
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-muted/40" />}>
          <UsersWorkspace
            rows={rows}
            roles={[...ASSIGNABLE_ROLES]}
            roleTemplates={ROLE_TEMPLATES}
            canUpdate={canUpdate}
            canRemove={canRemove}
            selectedId={selectedId}
            days={days}
            performanceByUserId={performanceByUserId}
          />
        </Suspense>
      )}
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { UsersIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { groupUserCompanies } from '@/lib/company-group'
import { formatDateTime } from '@/lib/date'
import {
  isUserOnline,
  presenceActivityLabel,
  presenceLabel,
} from '@/lib/presence'
import { ASSIGNABLE_ROLES, membershipStatusLabel, ROLE_LABELS } from '@/lib/roles'
import { parsePerformanceDays } from '@/lib/user-performance'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as platformActivity from '@/server/services/platform-activity.service'
import * as userService from '@/server/services/user.service'
import type { SystemUserReportView } from './system-user-panel'
import { SystemUsersWorkspace, type SystemUserRow } from './system-users-workspace'
import type { Role } from '@prisma/client'

export const metadata: Metadata = { title: 'System users' }

function overallMembershipStatus(statuses: string[]) {
  if (statuses.length === 0) return null
  if (statuses.every((status) => status === 'SUSPENDED')) return 'SUSPENDED'
  if (statuses.every((status) => status === 'INVITED' || status === 'SUSPENDED')) return 'INVITED'
  if (statuses.every((status) => status === 'ACTIVE')) return 'ACTIVE'
  if (statuses.includes('INVITED')) return 'INVITED'
  if (statuses.includes('SUSPENDED')) return 'SUSPENDED'
  return 'ACTIVE'
}

/**
 * Installation-wide staff logins. System owner only.
 * Passwords are never listed — reset creates a new temporary work password.
 */
export default async function SystemUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('org:update')
  if (!ctx.isSystemOwner) redirect('/databases')

  const params = await searchParams
  const query = parseListQuery(params)
  const userRaw = params.user
  const selectedId = (Array.isArray(userRaw) ? userRaw[0] : userRaw)?.trim() || null
  const daysRaw = params.days
  const days = parsePerformanceDays(Array.isArray(daysRaw) ? daysRaw[0] : daysRaw)
  const [{ rows, total }, companies, personReport] = await Promise.all([
    userService.listSystemUsers(ctx, query),
    userService.listAssignableCompanies(ctx),
    selectedId
      ? platformActivity.getPlatformPersonReport(ctx, selectedId, { days })
      : Promise.resolve(null),
  ])

  const mapped: SystemUserRow[] = rows.map((user) => {
    const isSelf = user.id === ctx.userId
    const staffMemberships = user.memberships.filter((row) => row.role !== 'CUSTOMER')
    const portalMemberships = user.memberships.filter((row) => row.role === 'CUSTOMER')
    const groups = groupUserCompanies(staffMemberships)
    const ownsCompany = staffMemberships.some((row) => row.role === 'OWNER')
    const hasStaffMembership = staffMemberships.some((row) => row.role !== 'OWNER')
    const overallStatus = overallMembershipStatus(staffMemberships.map((row) => row.status))
    const statusVariant =
      overallStatus === 'ACTIVE'
        ? 'success'
        : overallStatus === 'SUSPENDED'
          ? 'destructive'
          : overallStatus === 'INVITED'
            ? 'warning'
            : null

    const kind =
      user.isSystemOwner
        ? 'platform'
        : staffMemberships.length > 0
          ? 'staff'
          : portalMemberships.length > 0
            ? 'portal'
            : 'orphan'

    const kindLabel =
      kind === 'platform'
        ? 'Platform login · needed'
        : kind === 'staff'
          ? 'Company staff'
          : kind === 'portal'
            ? 'Customer portal'
            : 'Unused login'

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isSelf,
      isSystemOwner: user.isSystemOwner,
      ownsCompany,
      hasStaffMembership,
      kind,
      kindLabel,
      status: overallStatus,
      statusLabel: overallStatus ? membershipStatusLabel(overallStatus) : null,
      statusVariant,
      companies: groups.map((group) => ({
        rootId: group.rootId,
        name: group.name,
        companyCount: group.companyCount,
        roleLabel: ROLE_LABELS[group.role as Role] ?? group.role,
      })),
      portalCompanies: portalMemberships.map((row) => ({
        id: row.organization.id,
        name: row.organization.name,
      })),
      online: isUserOnline(user.lastSeenAt),
      presenceLabel: presenceLabel(isUserOnline(user.lastSeenAt)),
      lastActiveLabel: presenceActivityLabel(user.lastSeenAt),
      lastLoginLabel: user.lastLoginAt
        ? formatDateTime(user.lastLoginAt, ctx.organization.timeZone)
        : 'Never',
      createdLabel: formatDateTime(user.createdAt, ctx.organization.timeZone),
      twoFactorOn: Boolean(user.totpEnabledAt || user.otp2faEnabledAt),
      memberOrgIds: staffMemberships.map((row) => row.organization.id),
    }
  })

  const stats = {
    platform: mapped.filter((row) => row.kind === 'platform').length,
    staff: mapped.filter((row) => row.kind === 'staff').length,
    unused: mapped.filter((row) => row.kind === 'orphan').length,
    portal: mapped.filter((row) => row.kind === 'portal').length,
    twoFactor: mapped.filter((row) => row.twoFactorOn).length,
  }

  const report: SystemUserReportView | null = personReport
    ? {
        days: personReport.days,
        score: personReport.score,
        band: personReport.band,
        rank: personReport.rank,
        rankedAmong: personReport.rankedAmong,
        activeDays: personReport.activeDays,
        workActions: personReport.workActions,
        eventCount: personReport.eventCount,
        counts: personReport.counts,
        topActionLabel: personReport.topActionLabel,
        lastActiveLabel: personReport.lastActiveLabel,
        companyNames: personReport.companyNames,
        breakdown: personReport.breakdown,
        activity: personReport.activity.map((item) => ({
          id: item.id,
          atLabel: item.atLabel,
          actionLabel: item.actionLabel,
          entityLabel: item.entityLabel,
          detail: item.detail,
          orgName: item.orgName,
          ipAddress: item.ipAddress,
        })),
        daily: personReport.daily,
      }
    : null

  return (
    <div className="space-y-5">
      <PageHeader
        title="System users"
        description="Manage platform logins, company staff, unused leftovers, and portal access — assign to a company, force sign-out, reset password, or clean up."
      />
      <p className="-mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Link href="/settings/users" className="font-medium text-primary hover:underline">
          Company users
        </Link>
        <Link href="/databases" className="font-medium text-primary hover:underline">
          Databases
        </Link>
      </p>

      {total > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            [
              { label: 'Platform', value: stats.platform },
              { label: 'Company staff', value: stats.staff },
              { label: 'Unused', value: stats.unused },
              { label: 'Portal', value: stats.portal },
              { label: '2FA on', value: stats.twoFactor },
            ] as const
          ).map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border/60 bg-card/60 px-3 py-2.5"
            >
              <p className="text-[0.65rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                {stat.label}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{stat.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {total === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={query.q ? 'No users match that search' : 'No users yet'}
          description={
            query.q
              ? 'Try a different name or email address.'
              : 'People appear here when they are invited into any company.'
          }
        />
      ) : (
        <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-muted/40" />}>
          <SystemUsersWorkspace
            rows={mapped}
            selectedId={selectedId}
            companies={companies}
            roles={[...ASSIGNABLE_ROLES]}
            report={report}
          />
        </Suspense>
      )}
    </div>
  )
}

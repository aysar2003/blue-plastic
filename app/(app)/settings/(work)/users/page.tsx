import type { Metadata } from 'next'
import Link from 'next/link'
import { UsersIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
import { SearchInput } from '@/components/data/search-input'
import { Card } from '@/components/ui/card'
import { formatDateTime } from '@/lib/date'
import { appsOpenFor } from '@/lib/member-apps'
import { readSort } from '@/components/data/sortable-header'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import { ASSIGNABLE_ROLES, membershipStatusLabel, ROLE_LABELS } from '@/lib/roles'
import { effectivePermissions, permissionsFor } from '@/server/auth/permissions'
import * as membershipService from '@/server/services/membership.service'
import { InviteUserDialog } from './invite-user-dialog'
import { UsersTable, type UsersTableRow } from './users-table'
import type { Role } from '@prisma/client'

const SORTABLE = ['name', 'role', 'status', 'lastSeen'] as const

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
  const sort = readSort(params, SORTABLE, { sort: 'name', dir: 'asc' })
  const linkParams = { q: query.q, sort: sort.sort, dir: sort.dir }
  const { rows: members, total } = await membershipService.list(ctx, query)

  const direction = sort.dir === 'asc' ? 1 : -1
  const sorted = [...members].sort((a, b) => {
    switch (sort.sort) {
      case 'role':
        return direction * a.role.localeCompare(b.role) || a.user.name.localeCompare(b.user.name)
      case 'status':
        return direction * a.status.localeCompare(b.status) || a.user.name.localeCompare(b.user.name)
      case 'lastSeen':
        return (
          direction *
          ((a.user.lastLoginAt?.getTime() ?? 0) - (b.user.lastLoginAt?.getTime() ?? 0))
        )
      default:
        return direction * a.user.name.localeCompare(b.user.name)
    }
  })

  const canInvite = ctx.permissions.has('user:invite')
  const canUpdate = ctx.permissions.has('user:update')
  const canRemove = ctx.permissions.has('user:remove')

  const rows: UsersTableRow[] = sorted.map((member) => {
    const isSelf = member.user.id === ctx.userId
    const isOwner = member.role === 'OWNER'
    const perms = effectivePermissions(member.role as Role, member.permissionsOverride)
    const apps = appsOpenFor(perms)
    const canManageRow = (canUpdate || canRemove) && !isOwner && !isSelf
    const customCount = member.permissionsOverride.length
    const hasCustom =
      customCount > 0 || member.role === 'CUSTOM'

    return {
      id: member.id,
      role: member.role,
      status: member.status,
      permissionsOverride: member.permissionsOverride,
      canConnect: member.canConnect,
      isSelf,
      isOwner,
      canManageRow,
      showConnectToggle: ctx.isSystemOwner && member.role === 'ADMIN',
      name: member.user.name,
      email: member.user.email,
      userId: member.user.id,
      roleLabel: ROLE_LABELS[member.role],
      statusLabel: membershipStatusLabel(member.status),
      statusVariant:
        member.status === 'ACTIVE'
          ? 'success'
          : member.status === 'SUSPENDED'
            ? 'destructive'
            : 'warning',
      customPermissionNote: hasCustom
        ? `${customCount} custom permission${customCount === 1 ? '' : 's'}`
        : null,
      canConnectNote: member.canConnect && member.role === 'ADMIN',
      apps,
      lastLoginLabel: member.user.lastLoginAt
        ? formatDateTime(member.user.lastLoginAt, ctx.organization.timeZone)
        : '—',
    }
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Company users"
        description={
          ctx.isSystemOwner
            ? 'People in this company only. Connect can be given only to an admin. To see every login on the installation, open System users under Databases.'
            : 'People in this company. Assign a role or tick which apps each person may open — the same apps on the home screen. You can reset a work password; the old one is never shown.'
        }
        actions={
          canInvite ? (
            <InviteUserDialog roles={[...ASSIGNABLE_ROLES]} roleTemplates={ROLE_TEMPLATES} />
          ) : undefined
        }
      />
      {ctx.isSystemOwner ? (
        <p className="-mt-2 text-sm text-muted-foreground">
          <Link href="/databases/users" className="font-medium text-primary underline">
            System users
          </Link>{' '}
          — every login across all companies (owner only).
        </p>
      ) : null}
      {ctx.permissions.has('org:update') ? (
        <p className="-mt-2 text-sm text-muted-foreground">
          To turn an app off for everyone, use{' '}
          <Link href="/settings/features" className="font-medium text-primary underline">
            Settings → Configuration
          </Link>
          .
        </p>
      ) : null}
      <p className="-mt-2 text-sm text-muted-foreground">
        Sign-in, sign-out, and work for the last year:{' '}
        <Link href="/settings/user-history" className="font-medium text-primary underline">
          Settings → User history
        </Link>
        .
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search by name or email" />
      </div>

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
        <Card className="overflow-hidden p-0">
          <UsersTable
            rows={rows}
            sort={sort}
            linkParams={linkParams}
            roles={[...ASSIGNABLE_ROLES]}
            roleTemplates={ROLE_TEMPLATES}
            canUpdate={canUpdate}
            canRemove={canRemove}
          />
          <Pagination total={total} />
        </Card>
      )}
    </div>
  )
}

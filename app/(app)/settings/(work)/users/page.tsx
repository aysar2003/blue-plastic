import type { Metadata } from 'next'
import Link from 'next/link'
import { UsersIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SearchInput } from '@/components/data/search-input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/date'
import { appsOpenFor } from '@/lib/member-apps'
import { readSort, SortableHeader } from '@/components/data/sortable-header'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import { ASSIGNABLE_ROLES, ROLE_LABELS } from '@/lib/roles'
import { effectivePermissions, permissionsFor } from '@/server/auth/permissions'
import * as membershipService from '@/server/services/membership.service'
import { InviteUserDialog } from './invite-user-dialog'
import { MemberActions } from './member-actions'
import { ManageAccessButton } from './manage-access-button'
import type { Role } from '@prisma/client'

const SORTABLE = ['name', 'role', 'status', 'lastSeen'] as const

const ROLE_TEMPLATES = Object.fromEntries(
  ASSIGNABLE_ROLES.map((role) => [role, [...permissionsFor(role)]]),
) as Record<string, string[]>

export const metadata: Metadata = { title: 'Users' }

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
  const rows = [...members].sort((a, b) => {
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        description="Add people, assign a ready-made role, or tick which apps each person may open — the same apps on the home screen."
        actions={
          canInvite ? (
            <InviteUserDialog roles={[...ASSIGNABLE_ROLES]} roleTemplates={ROLE_TEMPLATES} />
          ) : undefined
        }
      />
      {ctx.permissions.has('org:update') ? (
        <p className="-mt-2 text-sm text-muted-foreground">
          To turn an app off for everyone, use{' '}
          <Link href="/settings/features" className="font-medium text-primary underline">
            Settings → Configuration
          </Link>
          .
        </p>
      ) : null}

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
          <ScrollSheet>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    column="name"
                    label="Member"
                    state={sort}
                    basePath="/settings/users"
                    params={linkParams}
                  />
                  <SortableHeader
                    column="role"
                    label="Role"
                    state={sort}
                    basePath="/settings/users"
                    params={linkParams}
                  />
                  <TableHead>Apps open</TableHead>
                  <SortableHeader
                    column="status"
                    label="Status"
                    state={sort}
                    basePath="/settings/users"
                    params={linkParams}
                  />
                  <SortableHeader
                    column="lastSeen"
                    label="Last signed in"
                    state={sort}
                    basePath="/settings/users"
                    params={linkParams}
                    defaultDirection="desc"
                  />
                  <TableHead className="w-[1%] whitespace-nowrap text-right">Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((member) => {
                  const isSelf = member.user.id === ctx.userId
                  const isOwner = member.role === 'OWNER'
                  const perms = effectivePermissions(
                    member.role as Role,
                    member.permissionsOverride,
                  )
                  const apps = appsOpenFor(perms)
                  const canManageRow = (canUpdate || canRemove) && !isOwner && !isSelf

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <span className="block font-medium">
                          {member.user.name}
                          {isSelf ? (
                            <span className="ml-2 text-xs text-muted-foreground">you</span>
                          ) : null}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {member.user.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="block">{ROLE_LABELS[member.role]}</span>
                        {member.permissionsOverride.length > 0 || member.role === 'CUSTOM' ? (
                          <span className="block text-xs text-muted-foreground">
                            {member.permissionsOverride.length} custom permission
                            {member.permissionsOverride.length === 1 ? '' : 's'}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {apps.length === 0 ? (
                          <span className="text-xs text-muted-foreground">None</span>
                        ) : (
                          <div className="flex max-w-[18rem] flex-wrap gap-1">
                            {apps.slice(0, 6).map((app) => (
                              <Badge key={app.id} variant="secondary" className="font-normal">
                                {app.label}
                              </Badge>
                            ))}
                            {apps.length > 6 ? (
                              <Badge variant="outline" className="font-normal">
                                +{apps.length - 6}
                              </Badge>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.status === 'ACTIVE'
                              ? 'success'
                              : member.status === 'SUSPENDED'
                                ? 'destructive'
                                : 'secondary'
                          }
                        >
                          {member.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.user.lastLoginAt
                          ? formatDateTime(member.user.lastLoginAt, ctx.organization.timeZone)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManageRow ? (
                          <div className="inline-flex items-center justify-end gap-1">
                            {canUpdate ? (
                              <ManageAccessButton
                                membershipId={member.id}
                                role={member.role}
                                name={member.user.name}
                                permissionsOverride={member.permissionsOverride}
                                roles={[...ASSIGNABLE_ROLES]}
                                roleTemplates={ROLE_TEMPLATES}
                              />
                            ) : null}
                            <MemberActions
                              membershipId={member.id}
                              role={member.role}
                              status={member.status}
                              name={member.user.name}
                              permissionsOverride={member.permissionsOverride}
                              roles={[...ASSIGNABLE_ROLES]}
                              roleTemplates={ROLE_TEMPLATES}
                              canUpdate={canUpdate}
                              canRemove={canRemove}
                            />
                          </div>
                        ) : isOwner ? (
                          <span className="text-xs text-muted-foreground">Owner</span>
                        ) : isSelf ? (
                          <span className="text-xs text-muted-foreground">You</span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollSheet>
          <Pagination total={total} />
        </Card>
      )}
    </div>
  )
}

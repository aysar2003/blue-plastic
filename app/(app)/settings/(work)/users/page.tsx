import type { Metadata } from 'next'
import { UsersIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { Pagination } from '@/components/data/pagination'
import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SearchInput } from '@/components/data/search-input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/date'
import { readSort, SortableHeader } from '@/components/data/sortable-header'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import { ASSIGNABLE_ROLES, ROLE_LABELS } from '@/lib/roles'
import { permissionsFor } from '@/server/auth/permissions'
import * as membershipService from '@/server/services/membership.service'
import { InviteUserDialog } from './invite-user-dialog'
import { MemberActions } from './member-actions'

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

  // A membership list is short and its columns come from two tables, so it is
  // ordered here rather than in the query.
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput placeholder="Search by name or email" />
        {canInvite ? (
          <InviteUserDialog roles={[...ASSIGNABLE_ROLES]} roleTemplates={ROLE_TEMPLATES} />
        ) : null}
      </div>

      {total === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={query.q ? 'No members match that search' : 'No members yet'}
          description={
            query.q
              ? 'Try a different name or email address.'
              : 'Add the people who need access to the books.'
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
                <SortableHeader column="name" label="Member" state={sort} basePath="/settings/users" params={linkParams} />
                <SortableHeader column="role" label="Role" state={sort} basePath="/settings/users" params={linkParams} />
                <SortableHeader column="status" label="Status" state={sort} basePath="/settings/users" params={linkParams} />
                <SortableHeader column="lastSeen" label="Last signed in" state={sort} basePath="/settings/users" params={linkParams} defaultDirection="desc" />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((member) => {
                const isSelf = member.user.id === ctx.userId
                const isOwner = member.role === 'OWNER'

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <span className="block font-medium">
                        {member.user.name}
                        {isSelf ? <span className="ml-2 text-xs text-muted-foreground">you</span> : null}
                      </span>
                      <span className="block text-xs text-muted-foreground">{member.user.email}</span>
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
                    <TableCell>
                      {(canUpdate || canRemove) && !isOwner && !isSelf ? (
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

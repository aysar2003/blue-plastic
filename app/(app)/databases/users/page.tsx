import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
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
import { ROLE_LABELS } from '@/lib/roles'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as userService from '@/server/services/user.service'
import { SystemUserActions } from './system-user-actions'
import type { Role } from '@prisma/client'

export const metadata: Metadata = { title: 'System users' }

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
  const { rows, total } = await userService.listSystemUsers(ctx, query)

  return (
    <div className="space-y-4">
      <PageHeader
        title="System users"
        description="Every staff login on this installation. You can set a new work password — the old one is never shown or retrieved. Company members are managed under Settings → Company users."
      />
      <p className="-mt-2 text-sm text-muted-foreground">
        <Link href="/settings/users" className="font-medium text-primary underline">
          Company users
        </Link>{' '}
        for the company you have open ·{' '}
        <Link href="/databases" className="font-medium text-primary underline">
          Databases
        </Link>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search by name or email" />
      </div>

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
        <Card className="overflow-hidden p-0">
          <ScrollSheet>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead>Last signed in</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-right">Password</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((user) => {
                  const isSelf = user.id === ctx.userId
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <span className="block font-medium">
                          {user.name}
                          {isSelf ? (
                            <span className="ml-2 text-xs text-muted-foreground">you</span>
                          ) : null}
                          {user.isSystemOwner ? (
                            <Badge variant="secondary" className="ml-2 font-normal">
                              System owner
                            </Badge>
                          ) : null}
                        </span>
                        <span className="block text-xs text-muted-foreground">{user.email}</span>
                      </TableCell>
                      <TableCell>
                        {user.memberships.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No company membership</span>
                        ) : (
                          <div className="flex max-w-md flex-col gap-1">
                            {user.memberships.map((membership) => (
                              <span key={membership.id} className="text-sm">
                                <span className="font-medium">{membership.organization.name}</span>
                                <span className="text-muted-foreground">
                                  {' '}
                                  · {ROLE_LABELS[membership.role as Role] ?? membership.role}
                                  {membership.status !== 'ACTIVE'
                                    ? ` · ${membership.status.toLowerCase()}`
                                    : ''}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.lastLoginAt
                          ? formatDateTime(user.lastLoginAt, ctx.organization.timeZone)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <SystemUserActions
                          userId={user.id}
                          name={user.name}
                          email={user.email}
                          isSelf={isSelf}
                        />
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

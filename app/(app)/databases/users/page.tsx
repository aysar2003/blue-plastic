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
import { groupUserCompanies } from '@/lib/company-group'
import { formatDateTime } from '@/lib/date'
import { membershipStatusLabel, ROLE_LABELS } from '@/lib/roles'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as userService from '@/server/services/user.service'
import { SystemUserActions } from './system-user-actions'
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
  const { rows, total } = await userService.listSystemUsers(ctx, query)

  return (
    <div className="space-y-4">
      <PageHeader
        title="System users"
        description="Every staff login on this installation. Related companies are grouped. You can set a person pending, delete a login, or set a new work password — the old one is never shown."
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
                  <TableHead>Status</TableHead>
                  <TableHead>Last signed in</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-right">Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((user) => {
                  const isSelf = user.id === ctx.userId
                  const groups = groupUserCompanies(user.memberships)
                  const ownsCompany = user.memberships.some((row) => row.role === 'OWNER')
                  const hasStaffMembership = user.memberships.some((row) => row.role !== 'OWNER')
                  const overallStatus = overallMembershipStatus(user.memberships.map((row) => row.status))
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
                        {groups.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No company membership</span>
                        ) : (
                          <div className="flex max-w-sm flex-col gap-1.5">
                            {groups.map((group) => (
                              <span key={group.rootId} className="text-sm">
                                <span className="font-medium">{group.name}</span>
                                <span className="text-muted-foreground">
                                  {group.companyCount > 1 ? ` · ${group.companyCount} companies` : ''}
                                  {' · '}
                                  {ROLE_LABELS[group.role as Role] ?? group.role}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {overallStatus ? (
                          <Badge
                            variant={
                              overallStatus === 'ACTIVE'
                                ? 'success'
                                : overallStatus === 'SUSPENDED'
                                  ? 'destructive'
                                  : 'warning'
                            }
                          >
                            {membershipStatusLabel(overallStatus)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
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
                          isSystemOwner={user.isSystemOwner}
                          ownsCompany={ownsCompany}
                          hasStaffMembership={hasStaffMembership}
                          status={overallStatus}
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

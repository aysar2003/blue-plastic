'use client'

import Link from 'next/link'
import type { MembershipStatus, Role } from '@prisma/client'

import { ScrollSheet } from '@/components/data/scroll-sheet'
import { SortableHeader, type SortState } from '@/components/data/sortable-header'
import { TableColumnCustomize } from '@/components/data/table-column-customize'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useTableColumnPrefs } from '@/lib/use-table-column-prefs'
import { ConnectToggle } from './connect-toggle'
import { ManageAccessButton } from './manage-access-button'
import { MemberActions } from './member-actions'

type ColumnId = 'member' | 'role' | 'apps' | 'status' | 'lastSeen'

const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'member', label: 'Member' },
  { id: 'role', label: 'Role' },
  { id: 'apps', label: 'Apps open' },
  { id: 'status', label: 'Status' },
  { id: 'lastSeen', label: 'Last signed in' },
]

/** Fixed layout so the sheet uses the full width; leftover space splits across open columns. */
const COLUMN_WIDTH: Record<ColumnId, string> = {
  member: 'w-[22%]',
  role: 'w-[12%]',
  apps: '',
  status: 'w-[9%]',
  lastSeen: 'w-[14%]',
}

const SORT_COLUMN: Partial<Record<ColumnId, string>> = {
  member: 'name',
  role: 'role',
  status: 'status',
  lastSeen: 'lastSeen',
}

export type UsersTableRow = {
  id: string
  role: Role
  status: MembershipStatus
  permissionsOverride: string[]
  canConnect: boolean
  isSelf: boolean
  isOwner: boolean
  canManageRow: boolean
  showConnectToggle: boolean
  name: string
  email: string
  userId: string
  roleLabel: string
  statusLabel: string
  statusVariant: 'success' | 'destructive' | 'warning'
  customPermissionNote: string | null
  canConnectNote: boolean
  apps: { id: string; label: string }[]
  lastLoginLabel: string
}

export function UsersTable({
  rows,
  sort,
  linkParams,
  roles,
  roleTemplates,
  canUpdate,
  canRemove,
}: {
  rows: UsersTableRow[]
  sort: SortState
  linkParams: Record<string, string | undefined>
  roles: Role[]
  roleTemplates: Record<string, string[]>
  canUpdate: boolean
  canRemove: boolean
}) {
  const { prefs, visible, toggle, reorder } = useTableColumnPrefs('bpc.usersColumns', COLUMNS)

  return (
    <div>
      <div className="mb-3 flex justify-end print:hidden">
        <TableColumnCustomize
          columns={COLUMNS}
          prefs={prefs}
          onToggle={toggle}
          onReorder={reorder}
        />
      </div>
      <ScrollSheet>
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              {visible.map((col) => {
                const sortKey = SORT_COLUMN[col.id]
                const width = COLUMN_WIDTH[col.id]
                if (sortKey) {
                  return (
                    <SortableHeader
                      key={col.id}
                      column={sortKey}
                      label={col.label}
                      state={sort}
                      basePath="/settings/users"
                      params={linkParams}
                      className={width}
                      defaultDirection={col.id === 'lastSeen' ? 'desc' : 'asc'}
                    />
                  )
                }
                return (
                  <TableHead key={col.id} className={width}>
                    {col.label}
                  </TableHead>
                )
              })}
              <TableHead className="w-36 whitespace-nowrap text-right">Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((member) => (
              <TableRow key={member.id}>
                {visible.map((col) => {
                  switch (col.id) {
                    case 'member':
                      return (
                        <TableCell key={col.id} className="min-w-0 whitespace-normal">
                          <span className="block truncate font-medium">
                            {member.name}
                            {member.isSelf ? (
                              <span className="ml-2 text-xs text-muted-foreground">you</span>
                            ) : null}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {member.email}
                          </span>
                          <Link
                            href={`/settings/user-history?userId=${member.userId}`}
                            className="mt-0.5 inline-block text-xs font-medium text-primary underline"
                          >
                            History
                          </Link>
                        </TableCell>
                      )
                    case 'role':
                      return (
                        <TableCell key={col.id} className="min-w-0 whitespace-normal">
                          <span className="block">{member.roleLabel}</span>
                          {member.customPermissionNote ? (
                            <span className="block text-xs text-muted-foreground">
                              {member.customPermissionNote}
                            </span>
                          ) : null}
                          {member.canConnectNote ? (
                            <span className="block text-xs text-muted-foreground">Can connect</span>
                          ) : null}
                        </TableCell>
                      )
                    case 'apps':
                      return (
                        <TableCell key={col.id} className="min-w-0 whitespace-normal">
                          {member.apps.length === 0 ? (
                            <span className="text-xs text-muted-foreground">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {member.apps.slice(0, 8).map((app) => (
                                <Badge key={app.id} variant="secondary" className="font-normal">
                                  {app.label}
                                </Badge>
                              ))}
                              {member.apps.length > 8 ? (
                                <Badge variant="outline" className="font-normal">
                                  +{member.apps.length - 8}
                                </Badge>
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                      )
                    case 'status':
                      return (
                        <TableCell key={col.id}>
                          <Badge variant={member.statusVariant}>{member.statusLabel}</Badge>
                        </TableCell>
                      )
                    case 'lastSeen':
                      return (
                        <TableCell key={col.id} className="text-muted-foreground">
                          {member.lastLoginLabel}
                        </TableCell>
                      )
                    default:
                      return null
                  }
                })}
                <TableCell className="text-right">
                  {member.canManageRow ? (
                    <div className="inline-flex flex-wrap items-center justify-end gap-1">
                      {member.showConnectToggle ? (
                        <ConnectToggle
                          membershipId={member.id}
                          enabled={member.canConnect}
                        />
                      ) : null}
                      {canUpdate ? (
                        <ManageAccessButton
                          membershipId={member.id}
                          role={member.role}
                          name={member.name}
                          permissionsOverride={member.permissionsOverride}
                          roles={roles}
                          roleTemplates={roleTemplates}
                        />
                      ) : null}
                      <MemberActions
                        membershipId={member.id}
                        role={member.role}
                        status={member.status}
                        name={member.name}
                        email={member.email}
                        permissionsOverride={member.permissionsOverride}
                        roles={roles}
                        roleTemplates={roleTemplates}
                        canUpdate={canUpdate}
                        canRemove={canRemove}
                      />
                    </div>
                  ) : member.isOwner ? (
                    <span className="text-xs text-muted-foreground">Owner</span>
                  ) : member.isSelf ? (
                    <span className="text-xs text-muted-foreground">You</span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollSheet>
    </div>
  )
}

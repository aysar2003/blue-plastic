import type { Metadata } from 'next'
import Link from 'next/link'
import { HistoryIcon } from 'lucide-react'

import { ClickableRow } from '@/components/data/clickable-row'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { QuerySelect } from '@/components/data/query-select'
import { SearchInput } from '@/components/data/search-input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/date'
import { USER_HISTORY_RETENTION_DAYS } from '@/lib/user-history'
import { parseListQuery } from '@/lib/validation/common'
import { requireOrgContext } from '@/server/auth/context'
import * as userHistoryService from '@/server/services/user-history.service'

export const metadata: Metadata = { title: 'User history' }

function actionVariant(action: string): 'success' | 'secondary' | 'destructive' | 'outline' {
  if (action === 'LOGIN' || action === 'RESTORE') return 'success'
  if (action === 'LOGOUT') return 'secondary'
  if (action === 'LOGIN_FAILED' || action === 'DELETE' || action === 'REJECT') return 'destructive'
  if (action === 'CREATE' || action === 'POST' || action === 'APPROVE') return 'outline'
  return 'secondary'
}

const ACTION_FILTERS = [
  { value: '', label: 'All actions' },
  { value: 'RESTORE', label: 'Restored' },
  { value: 'DELETE', label: 'Deleted' },
  { value: 'LOGIN', label: 'Signed in' },
  { value: 'LOGOUT', label: 'Signed out' },
  { value: 'CREATE', label: 'Entered' },
  { value: 'UPDATE', label: 'Changed' },
  { value: 'POST', label: 'Posted' },
] as const

export default async function UserHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('user:read')
  const params = await searchParams
  const parsed = parseListQuery(params)
  // Year-long audit trails are large; keep the table page-sized.
  const query = { ...parsed, pageSize: 100 }
  const userIdRaw = params.userId
  const userId = (Array.isArray(userIdRaw) ? userIdRaw[0] : userIdRaw)?.trim() || null
  const actionRaw = params.action
  const action = (Array.isArray(actionRaw) ? actionRaw[0] : actionRaw)?.trim() || null

  const [members, result] = await Promise.all([
    userHistoryService.listMembers(ctx),
    userHistoryService.list(ctx, { ...query, userId, action }),
  ])
  const { rows, total, page, pageCount } = result

  const memberOptions = [
    { value: '', label: 'Everyone' },
    ...members.map((member) => ({
      value: member.id,
      label: member.name,
    })),
  ]

  const selected = members.find((member) => member.id === userId)

  function pageHref(nextPage: number) {
    const search = new URLSearchParams()
    if (query.q) search.set('q', query.q)
    if (userId) search.set('userId', userId)
    if (action) search.set('action', action)
    if (nextPage > 1) search.set('page', String(nextPage))
    const text = search.toString()
    return text ? `/settings/user-history?${text}` : '/settings/user-history'
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="User history"
        description={`Sign-in, sign-out, and the work each person recorded — kept for ${USER_HISTORY_RETENTION_DAYS} days. Open a row to go to the live record when it still exists.`}
      />
      <p className="-mt-2 text-sm text-muted-foreground">
        Roles and app access are under{' '}
        <Link href="/settings/users" className="font-medium text-primary underline">
          Settings → Company users
        </Link>
        .
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <QuerySelect
          label="Person"
          param="userId"
          path="/settings/user-history"
          value={userId ?? ''}
          hidden={{ q: query.q, action: action ?? undefined }}
          options={memberOptions}
          className="min-w-48"
        />
        <QuerySelect
          label="Action"
          param="action"
          path="/settings/user-history"
          value={action ?? ''}
          hidden={{ q: query.q, userId: userId ?? undefined }}
          options={[...ACTION_FILTERS]}
          className="min-w-40"
        />
        <SearchInput placeholder="Search name, email, or document" />
      </div>

      {selected ? (
        <p className="text-xs text-muted-foreground">
          Showing {selected.name}
          {selected.email ? ` · ${selected.email}` : ''}.{' '}
          <Link href="/settings/user-history" className="font-medium text-primary underline">
            Show everyone
          </Link>
        </p>
      ) : null}

      {total === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title={query.q || userId || action ? 'No history matches' : 'No history yet'}
          description={
            query.q || userId || action
              ? 'Try another person, action, or a different search.'
              : 'Sign-ins, restores, and work recorded by people in this company will appear here.'
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          {/* embed: grow with every row — do not clip inside a viewport-height scrollport */}
          <Table embed>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <ClickableRow key={row.id} href={row.href ?? undefined}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(row.at, ctx.organization.timeZone)}
                    </TableCell>
                    <TableCell>
                      <span className="block font-medium">{row.who}</span>
                      {row.email ? (
                        <span className="block text-xs text-muted-foreground">{row.email}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(row.action)} className="font-normal">
                        {row.actionLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.entityLabel}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.detail ?? (row.href ? 'Open' : '—')}
                    </TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-3 py-1.5 text-xs">
            <p className="text-muted-foreground">
              <span className="tabular">{total}</span> {total === 1 ? 'row' : 'rows'}
              {pageCount > 1 ? (
                <span>
                  {' '}
                  · page <span className="tabular">{page}</span> of{' '}
                  <span className="tabular">{pageCount}</span>
                </span>
              ) : null}
            </p>
            {pageCount > 1 ? (
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link href={pageHref(page - 1)} className="font-medium text-primary underline">
                    Previous
                  </Link>
                ) : null}
                {page < pageCount ? (
                  <Link href={pageHref(page + 1)} className="font-medium text-primary underline">
                    Next
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  )
}

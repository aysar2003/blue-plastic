'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { Loader2Icon, ScrollTextIcon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiGet } from '@/lib/api'
import { formatDateTime } from '@/lib/date'

type AuditRow = {
  id: string
  entity: string
  entityId: string
  action: string
  at: string
  ipAddress: string | null
  actor: { id: string; name: string; email: string } | null
}

type AuditPage = { rows: AuditRow[]; total: number; page: number; pageCount: number }

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  CREATE: 'success',
  UPDATE: 'default',
  DELETE: 'destructive',
  ARCHIVE: 'warning',
  RESTORE: 'success',
  LOGIN: 'secondary',
  LOGIN_FAILED: 'destructive',
  LOGOUT: 'secondary',
}

export function ActivityList({ timeZone }: { timeZone: string }) {
  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['audit-logs'],
      initialPageParam: 1,
      queryFn: ({ pageParam }) => apiGet<AuditPage>('/api/audit-logs', { page: pageParam, pageSize: 25 }),
      getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
    })

  if (isPending) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-md border py-16 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Loading activity…
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        icon={ScrollTextIcon}
        title="Activity could not be loaded"
        description={error instanceof Error ? error.message : undefined}
      />
    )
  }

  const rows = data.pages.flatMap((page) => page.rows)

  if (rows.length === 0) {
    return <EmptyState icon={ScrollTextIcon} title="No activity recorded yet" />
  }

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>What</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground tabular">
                {formatDateTime(new Date(row.at), timeZone)}
              </TableCell>
              <TableCell>
                {row.actor ? (
                  <>
                    <span className="block font-medium">{row.actor.name}</span>
                    <span className="block text-xs text-muted-foreground">{row.actor.email}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">System</span>
                )}
              </TableCell>
              <TableCell>
                <span className="block">{row.entity}</span>
                <span className="block font-mono text-xs text-muted-foreground">{row.entityId.slice(0, 12)}…</span>
              </TableCell>
              <TableCell>
                <Badge variant={ACTION_VARIANT[row.action] ?? 'secondary'}>{row.action.toLowerCase()}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {hasNextPage ? (
        <div className="flex justify-center border-t p-3">
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? <Loader2Icon className="animate-spin" /> : null}
            Load more
          </Button>
        </div>
      ) : null}
    </Card>
  )
}

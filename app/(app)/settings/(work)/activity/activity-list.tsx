'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Loader2Icon, Trash2Icon } from 'lucide-react'

import { EmptyState } from '@/components/data/empty-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiGet } from '@/lib/api'
import { formatDateTime } from '@/lib/date'
import { ClearAllTrashButton } from './clear-trash-button'

type TrashRow = {
  id: string
  at: string
  who: string
  email: string | null
  kind: string
  name: string | null
  reason: string | null
}

type TrashPage = { rows: TrashRow[]; total: number; page: number; pageCount: number }

export function ActivityList({
  timeZone,
  canClear = false,
}: {
  timeZone: string
  canClear?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['trash', q],
      initialPageParam: 1,
      queryFn: ({ pageParam }) =>
        apiGet<TrashPage>('/api/audit-logs', { page: pageParam, pageSize: 25, ...(q ? { q } : {}) }),
      getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
    })

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <form
        className="flex max-w-sm flex-1 gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setQ(draft.trim())
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Number, name, or person"
          aria-label="Search trash"
        />
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
      </form>
      {canClear ? (
        <ClearAllTrashButton disabled={isPending || (data !== undefined && data.pages.every((page) => page.rows.length === 0) && !q)} />
      ) : null}
    </div>
  )

  if (isPending) {
    return (
      <div className="space-y-4">
        {toolbar}
        <div className="flex items-center justify-center gap-2 rounded-md border py-16 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Loading trash…
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-4">
        {toolbar}
        <EmptyState
          icon={Trash2Icon}
          title="Trash could not be loaded"
          description={error instanceof Error ? error.message : undefined}
        />
      </div>
    )
  }

  const rows = data.pages.flatMap((page) => page.rows)

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        {toolbar}
        <EmptyState
          icon={Trash2Icon}
          title={q ? 'Nothing in trash matches that' : 'Trash is empty'}
          description={q ? undefined : 'Deleted records will be listed here, and nowhere else.'}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {toolbar}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Deleted</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="w-48">View / restore</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground tabular">
                  {formatDateTime(new Date(row.at), timeZone)}
                </TableCell>
                <TableCell>
                  <span className="block font-medium">{row.who}</span>
                  {row.email ? (
                    <span className="block text-xs text-muted-foreground">{row.email}</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/settings/activity/${row.id}`}
                    className="block font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {row.kind}
                  </Link>
                  {row.name ? <span className="block text-sm text-muted-foreground">{row.name}</span> : null}
                </TableCell>
                <TableCell className="max-w-xs text-muted-foreground">{row.reason ?? '—'}</TableCell>
                <TableCell className="space-x-2 whitespace-nowrap text-sm">
                  <Link
                    href={`/settings/activity/${row.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    View
                  </Link>
                  <a
                    href={`/api/trash/${row.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    PDF
                  </a>
                  <Link
                    href={`/settings/activity/${row.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Restore
                  </Link>
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
    </div>
  )
}

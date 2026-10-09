import Link from 'next/link'
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react'

import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type SortDirection = 'asc' | 'desc'

export type SortState = { sort: string; dir: SortDirection }

/**
 * A column header that sorts.
 *
 * Sorting lives in the URL, like the page number and the search: the ordering
 * you are looking at survives a refresh and can be sent to somebody else. That
 * also keeps the table a Server Component — the sort happens in the database,
 * over every row, not in the browser over the page you happen to be on. Sorting
 * only the visible page is the bug this avoids.
 */
export function SortableHeader({
  column,
  label,
  state,
  basePath,
  params,
  className,
  numeric,
  /** The direction a first click should apply. Amounts read high-to-low first. */
  defaultDirection = 'asc',
}: {
  column: string
  label: string
  state: SortState
  basePath: string
  params?: Record<string, string | undefined>
  className?: string
  numeric?: boolean
  defaultDirection?: SortDirection
}) {
  const active = state.sort === column
  const next: SortDirection = active ? (state.dir === 'asc' ? 'desc' : 'asc') : defaultDirection

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value && key !== 'page') search.set(key, value)
  }
  search.set('sort', column)
  search.set('dir', next)

  const Icon = active ? (state.dir === 'asc' ? ArrowUpIcon : ArrowDownIcon) : ChevronsUpDownIcon

  return (
    <TableHead className={cn(numeric && 'numeric', className)} aria-sort={active ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <Link
        href={`${basePath}?${search.toString()}`}
        // Changing the sort returns to the first page: page 3 of a different
        // ordering is not the same rows, and landing there is disorienting.
        scroll={false}
        className={cn(
          'flex w-full min-w-0 items-start gap-1 whitespace-normal rounded-sm transition-colors hover:text-foreground',
          numeric && 'flex-row-reverse',
          active ? 'text-foreground' : 'text-foreground/80',
        )}
      >
        <span className="min-w-0">{label}</span>
        <Icon className={cn('mt-0.5 size-3.5 shrink-0', !active && 'opacity-55')} />
      </Link>
    </TableHead>
  )
}

/** Reads `sort` and `dir` out of the query string, with a fallback. */
export function readSort(
  params: Record<string, string | string[] | undefined>,
  allowed: readonly string[],
  fallback: SortState,
): SortState {
  const sort = typeof params.sort === 'string' && allowed.includes(params.sort) ? params.sort : fallback.sort
  const dir = params.dir === 'asc' || params.dir === 'desc' ? params.dir : fallback.dir
  return { sort, dir }
}

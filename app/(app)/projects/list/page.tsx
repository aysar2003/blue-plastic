import type { Metadata } from 'next'
import Link from 'next/link'
import { PlusIcon } from 'lucide-react'
import type { ProjectStatus } from '@prisma/client'

import { ClickableRow } from '@/components/data/clickable-row'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Pagination } from '@/components/data/pagination'
import { SearchInput } from '@/components/data/search-input'
import { FilterChips } from '@/components/data/filter-chips'
import { readSort, SortableHeader } from '@/components/data/sortable-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { parseListQuery } from '@/lib/validation/common'
import { PROJECT_STATUS_LABELS, PROJECT_STATUSES } from '@/lib/validation/project'
import { requireOrgContext } from '@/server/auth/context'
import * as projectService from '@/server/services/project.service'

export const metadata: Metadata = { title: 'All projects' }

const SORTABLE = ['number', 'name', 'customer', 'status', 'updatedAt'] as const
const BASE_PATH = '/projects/list'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  ...PROJECT_STATUSES.map((status) => ({
    value: status,
    label: PROJECT_STATUS_LABELS[status],
  })),
]

function isStatus(value: string | undefined): value is ProjectStatus {
  return PROJECT_STATUSES.some((status) => status === value)
}

function statusVariant(status: ProjectStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'success' as const
    case 'ON_HOLD':
      return 'warning' as const
    case 'DONE':
      return 'secondary' as const
    case 'CANCELLED':
      return 'destructive' as const
    default:
      return 'outline' as const
  }
}

export default async function ProjectsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('project:read')
  const params = await searchParams
  const query = parseListQuery(params)
  const sort = readSort(params, SORTABLE, { sort: 'updatedAt', dir: 'desc' })
  const statusValue = typeof params.status === 'string' ? params.status : undefined
  const status = isStatus(statusValue) ? statusValue : undefined
  const q = typeof params.q === 'string' ? params.q : undefined

  const linkParams: Record<string, string | undefined> = {
    q,
    status: status ?? undefined,
    sort: sort.sort,
    dir: sort.dir,
  }

  const page = await projectService.list(ctx, query, {
    status,
    sort: sort.sort,
    dir: sort.dir,
  })

  const canCreate = ctx.permissions.has('project:create')

  return (
    <>
      <PageHeader
        title="All projects"
        description="Customer job folders — estimates, orders, and invoices for a site of work."
        actions={
          canCreate ? (
            <Link href="/projects/new" className={buttonVariants({ size: 'sm' })}>
              <PlusIcon /> New project
            </Link>
          ) : null
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search number, name, customer…" />
        <FilterChips
          options={STATUS_FILTERS}
          active={status ?? ''}
          path={BASE_PATH}
          param="status"
          params={linkParams}
        />
      </div>

      {page.rows.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a job folder for a customer site, then add an estimate from the project."
          action={
            canCreate ? (
              <Link href="/projects/new" className={buttonVariants()}>
                New project
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader
                  column="number"
                  label="Number"
                  state={sort}
                  basePath={BASE_PATH}
                  params={linkParams}
                />
                <SortableHeader
                  column="name"
                  label="Name"
                  state={sort}
                  basePath={BASE_PATH}
                  params={linkParams}
                />
                <SortableHeader
                  column="customer"
                  label="Customer"
                  state={sort}
                  basePath={BASE_PATH}
                  params={linkParams}
                />
                <TableHead>Site</TableHead>
                <SortableHeader
                  column="status"
                  label="Status"
                  state={sort}
                  basePath={BASE_PATH}
                  params={linkParams}
                />
                <TableHead>Dates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.rows.map((row) => (
                <ClickableRow key={row.id} href={`/projects/${row.id}`}>
                  <TableCell className="font-medium tabular">{row.number}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.customer.displayName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.siteLocation ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>
                      {PROJECT_STATUS_LABELS[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn('text-sm text-muted-foreground')}>
                    {row.startDate ? formatDate(row.startDate) : '—'}
                    {row.endDate ? ` → ${formatDate(row.endDate)}` : ''}
                  </TableCell>
                </ClickableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Pagination total={page.total} />
    </>
  )
}

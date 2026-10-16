import type { Metadata } from 'next'
import Link from 'next/link'
import { PlusIcon } from 'lucide-react'
import type { ProjectStatus } from '@prisma/client'

import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PROJECT_STATUS_LABELS } from '@/lib/validation/project'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export const metadata: Metadata = { title: 'Projects' }

const BOARD: ProjectStatus[] = ['DRAFT', 'ACTIVE', 'ON_HOLD', 'DONE']

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

/**
 * Odoo-style Projects home: kanban by status, then links into the register.
 */
export default async function ProjectsHubPage() {
  const ctx = await requireOrgContext('project:read')
  const canCreate = ctx.permissions.has('project:create')

  const projects = await db.project.findMany({
    where: { orgId: ctx.orgId, status: { not: 'CANCELLED' } },
    select: {
      id: true,
      number: true,
      name: true,
      status: true,
      siteLocation: true,
      customer: { select: { displayName: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 200,
  })

  return (
    <>
      <PageHeader
        title="Projects"
        description="Customer jobs with tasks and linked sales — the Odoo Projects pattern: board first, documents on the job folder."
        actions={
          <>
            <Link href="/projects/list" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              List
            </Link>
            {canCreate ? (
              <Link href="/projects/new" className={buttonVariants({ size: 'sm' })}>
                <PlusIcon /> New project
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {BOARD.map((status) => {
          const column = projects.filter((row) => row.status === status)
          return (
            <div key={status} className="min-h-[14rem] rounded-xl border border-border bg-muted/25 p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {PROJECT_STATUS_LABELS[status]}
                </p>
                <span className="text-[10px] tabular text-muted-foreground">{column.length}</span>
              </div>
              <ul className="space-y-2">
                {column.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/projects/${row.id}`}
                      className="block rounded-lg border border-border bg-card p-2.5 shadow-sm transition-colors hover:border-primary/40"
                    >
                      <p className="text-xs tabular text-muted-foreground">{row.number}</p>
                      <p className="text-sm font-semibold text-foreground">{row.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {row.customer.displayName}
                        {row.siteLocation ? ` · ${row.siteLocation}` : ''}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant={statusVariant(row.status)} className="text-[10px]">
                          {PROJECT_STATUS_LABELS[row.status]}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {row._count.tasks} task{row._count.tasks === 1 ? '' : 's'}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
                {column.length === 0 ? (
                  <li className="px-1 py-8 text-center text-xs text-muted-foreground">No projects</li>
                ) : null}
              </ul>
            </div>
          )
        })}
      </div>

      <Card className="mt-6 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How it works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            <Link href="/projects/new" className="text-primary underline-offset-2 hover:underline">
              Create a project
            </Link>{' '}
            for the customer and site.
          </li>
          <li>Add tasks on the job board and move them through the stages.</li>
          <li>Attach estimates, orders, and invoices from the project when Sales is on.</li>
        </ol>
      </Card>
    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as projectTimeService from '@/server/services/project-time.service'

export const metadata: Metadata = { title: 'My timesheets' }

export default async function MyProjectTimesheetsPage() {
  const ctx = await requireOrgContext('project:read')
  const entries = await projectTimeService.listMine(ctx)

  return (
    <>
      <PageHeader
        title="My timesheets"
        description="Hours you logged on projects."
        className="mb-4"
      />
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No time logged yet.</p>
      ) : (
        <Card className="divide-y">
          {entries.map((entry) => (
            <Link
              key={entry.id}
              href={`/projects/${entry.project.id}`}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted/40"
            >
              <div>
                <p className="font-medium tabular">
                  {entry.hours}h · {entry.project.number} · {entry.project.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(entry.workDate)}
                  {entry.task ? ` · ${entry.task.name}` : ''}
                  {entry.description ? ` · ${entry.description}` : ''}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {entry.billable ? (entry.invoicedAt ? 'Invoiced' : 'Billable') : 'Non-billable'}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </>
  )
}

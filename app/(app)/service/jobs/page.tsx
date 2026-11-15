import type { Metadata } from 'next'
import Link from 'next/link'

import {
  cancelJobAction,
  completeJobAction,
  scheduleJobAction,
} from '@/app/(app)/service/jobs/actions'
import { PageHeader } from '@/components/data/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  canCancelServiceJob,
  canCompleteServiceJob,
  canScheduleServiceJob,
  type ServiceJobStatus,
} from '@/lib/erp/service-job'
import { requireOrgContext } from '@/server/auth/context'
import * as serviceJobService from '@/server/services/service-job.service'

export const metadata: Metadata = { title: 'Service jobs' }

export default async function ServiceJobsPage() {
  const ctx = await requireOrgContext('invoice:read')
  const rows = await serviceJobService.list(ctx)
  const canEdit = ctx.permissions.has('invoice:create')

  return (
    <>
      <PageHeader
        title="Service jobs"
        description="Schedule field work, then complete to post an invoice and issue van stock."
        actions={
          canEdit ? (
            <Link href="/service/jobs/new" className={buttonVariants({ size: 'sm' })}>
              New job
            </Link>
          ) : null
        }
      />

      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <Link href={`/service/jobs/${row.id}`} className="font-medium text-primary hover:underline">
              {row.number}
            </Link>
            <span>
              {row.customer.displayName}
              {row.assignee ? ` · ${row.assignee.name}` : ''} · {row.status}
              {row.salesDocument ? ` · ${row.salesDocument.number}` : ''}
            </span>
            {canEdit && canScheduleServiceJob(row.status as ServiceJobStatus) ? (
              <form action={scheduleJobAction}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Schedule
                </Button>
              </form>
            ) : null}
            {canEdit && canCompleteServiceJob(row.status as ServiceJobStatus) ? (
              <form action={completeJobAction}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm">
                  Complete
                </Button>
              </form>
            ) : null}
            {canEdit && canCancelServiceJob(row.status as ServiceJobStatus) ? (
              <form action={cancelJobAction}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Cancel
                </Button>
              </form>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? (
          <Card className="px-4 py-8 text-sm text-muted-foreground">No service jobs yet.</Card>
        ) : null}
      </ul>
    </>
  )
}
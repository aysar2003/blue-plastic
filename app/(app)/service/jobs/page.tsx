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
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import {
  canCancelServiceJob,
  canCompleteServiceJob,
  canScheduleServiceJob,
  promisedWindowLabel,
  type ServiceJobStatus,
} from '@/lib/erp/service-job'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as serviceJobService from '@/server/services/service-job.service'

export const metadata: Metadata = { title: 'Service jobs' }

export default async function ServiceJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; assignee?: string }>
}) {
  const ctx = await requireOrgContext('invoice:read')
  const query = await searchParams
  const date = query.date?.trim() || ''
  const assigneeId = query.assignee?.trim() || ''
  const [rows, technicians] = await Promise.all([
    serviceJobService.list(ctx, {
      date: date || undefined,
      assigneeId: assigneeId || undefined,
    }),
    db.membership.findMany({
      where: { orgId: ctx.orgId },
      select: { user: { select: { id: true, name: true } } },
      take: 100,
    }),
  ])
  const canEdit = ctx.permissions.has('invoice:create')
  const day = today(ctx.organization.timeZone)

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

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs">
          Day
          <Input name="date" type="date" defaultValue={date} className="mt-1 h-8 w-40" />
        </label>
        <label className="text-xs">
          Technician
          <NativeSelect name="assignee" defaultValue={assigneeId} className="mt-1 h-8 w-48">
            <option value="">All technicians</option>
            {technicians.map((row) => (
              <option key={row.user.id} value={row.user.id}>
                {row.user.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit" size="sm" variant="outline">
          Filter
        </Button>
        <Link href={`/service/jobs?date=${day}`} className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
          Today
        </Link>
        {date || assigneeId ? (
          <Link href="/service/jobs" className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
            Clear
          </Link>
        ) : null}
      </form>

      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <Link href={`/service/jobs/${row.id}`} className="font-medium text-primary hover:underline">
              {row.number}
            </Link>
            <span>
              {row.customer.displayName}
              {row.assignee ? ` · ${row.assignee.name}` : ''}
              {row.siteLocation ? ` · ${row.siteLocation}` : ''} · {row.status}
              {promisedWindowLabel(row.promisedWindowStart, row.promisedWindowEnd)
                ? ` · ${promisedWindowLabel(row.promisedWindowStart, row.promisedWindowEnd)}`
                : ''}
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
          <Card className="px-4 py-8 text-sm text-muted-foreground">
            {date ? `No service jobs on ${date}.` : 'No service jobs yet.'}
          </Card>
        ) : null}
      </ul>
    </>
  )
}

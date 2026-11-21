import type { Metadata } from 'next'
import Link from 'next/link'

import {
  cancelJobAction,
  completeJobAction,
  replenishVanAction,
  scheduleJobAction,
} from '@/app/(app)/service/jobs/actions'
import { PageHeader } from '@/components/data/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  canCancelServiceJob,
  canCompleteServiceJob,
  canScheduleServiceJob,
  promisedWindowLabel,
  type ServiceJobStatus,
} from '@/lib/erp/service-job'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as serviceJobService from '@/server/services/service-job.service'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: `Service job ${id.slice(0, 8)}` }
}

export default async function ServiceJobDetailPage({ params }: Props) {
  const { id } = await params
  const ctx = await requireOrgContext('invoice:read')
  const job = await serviceJobService.get(ctx, id)
  const canEdit = ctx.permissions.has('invoice:create')
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title={job.number}
        description={`${job.customer.displayName} · ${job.status}`}
        actions={
          <Link href="/service/jobs" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            All jobs
          </Link>
        }
      />

      <Card>
        <CardContent className="space-y-3 p-4 text-sm">
          {job.project ? (
            <p>
              Project: {job.project.number} · {job.project.name}
            </p>
          ) : null}
          {job.assignee ? <p>Assignee: {job.assignee.name}</p> : null}
          {job.siteLocation ? <p>Site: {job.siteLocation}</p> : null}
          {promisedWindowLabel(job.promisedWindowStart, job.promisedWindowEnd) ? (
            <p>Window: {promisedWindowLabel(job.promisedWindowStart, job.promisedWindowEnd)}</p>
          ) : null}
          {job.vanStore ? <p>Van: {job.vanStore.name}</p> : null}
          {job.memo ? <p className="text-muted-foreground">{job.memo}</p> : null}
          {job.salesDocument ? (
            <p>
              Invoice:{' '}
              <Link href={`/sales/invoices/${job.salesDocument.id}`} className="text-primary hover:underline">
                {job.salesDocument.number}
              </Link>
            </p>
          ) : null}

          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-1">Kind</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {job.lines.map((line) => (
                <tr key={line.id} className="border-b">
                  <td className="py-1">{line.kind}</td>
                  <td>{line.item?.name ?? line.description}</td>
                  <td>{line.quantity}</td>
                  <td>{formatMoney(line.unitPrice, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap gap-2 pt-2">
            {canEdit && canScheduleServiceJob(job.status as ServiceJobStatus) ? (
              <form action={scheduleJobAction}>
                <input type="hidden" name="id" value={job.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Schedule
                </Button>
              </form>
            ) : null}
            {canEdit && canCompleteServiceJob(job.status as ServiceJobStatus) ? (
              <form action={completeJobAction}>
                <input type="hidden" name="id" value={job.id} />
                <Button type="submit" size="sm">
                  Complete & invoice
                </Button>
              </form>
            ) : null}
            {canEdit && job.vanStore && (job.status === 'DRAFT' || job.status === 'SCHEDULED') ? (
              <form action={replenishVanAction}>
                <input type="hidden" name="id" value={job.id} />
                <Button type="submit" size="sm" variant="outline">
                  Draft van replenish
                </Button>
              </form>
            ) : null}
            {canEdit && canCancelServiceJob(job.status as ServiceJobStatus) ? (
              <form action={cancelJobAction}>
                <input type="hidden" name="id" value={job.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Cancel
                </Button>
              </form>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
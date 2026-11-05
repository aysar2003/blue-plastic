import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  canCancelWorkOrder,
  canCompleteWorkOrder,
  canReleaseWorkOrder,
  type WorkOrderStatus,
} from '@/lib/erp/work-order'
import { requireOrgContext } from '@/server/auth/context'
import * as workOrderService from '@/server/services/work-order.service'

import { cancelWorkOrder, completeWorkOrder, releaseWorkOrder } from '../actions'

export const metadata: Metadata = { title: 'Work order' }

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext('inventory:read')
  const { id } = await params
  let wo
  try {
    wo = await workOrderService.get(ctx, id)
  } catch {
    notFound()
  }
  const canAdjust = ctx.permissions.has('inventory:adjust')
  const status = wo.status as WorkOrderStatus

  return (
    <>
      <PageHeader
        title={wo.number}
        description={`${wo.quantity} × ${wo.item.name} · ${wo.status}`}
        actions={
          <Link href="/inventory/work-orders" className={buttonVariants({ size: 'sm', variant: 'secondary' })}>
            All work orders
          </Link>
        }
      />

      <Card className="mb-4 space-y-1 p-4 text-sm">
        <p>Date: {wo.date.toISOString().slice(0, 10)}</p>
        {wo.dueDate ? <p>Due: {wo.dueDate.toISOString().slice(0, 10)}</p> : null}
        {wo.store ? <p>Store: {wo.store.name}</p> : null}
        {wo.memo ? <p>Memo: {wo.memo}</p> : null}
        {wo.build ? (
          <p>
            Build:{' '}
            <Link href="/inventory/builds/new" className="text-primary hover:underline">
              {wo.build.number}
            </Link>
          </p>
        ) : null}
      </Card>

      <h2 className="mb-2 text-sm font-medium">Components</h2>
      <ul className="mb-6 divide-y rounded-md border text-sm">
        {wo.lines.map((line) => (
          <li key={line.id} className="flex justify-between px-3 py-2">
            <span>{line.item.name}</span>
            <span>{line.quantity}</span>
          </li>
        ))}
      </ul>

      {canAdjust ? (
        <div className="flex flex-wrap gap-2">
          {canReleaseWorkOrder(status) ? (
            <form action={releaseWorkOrder}>
              <input type="hidden" name="id" value={wo.id} />
              <Button type="submit" variant="secondary">
                Release
              </Button>
            </form>
          ) : null}
          {canCompleteWorkOrder(status) ? (
            <form action={completeWorkOrder}>
              <input type="hidden" name="id" value={wo.id} />
              <Button type="submit">Complete build</Button>
            </form>
          ) : null}
          {canCancelWorkOrder(status) ? (
            <form action={cancelWorkOrder}>
              <input type="hidden" name="id" value={wo.id} />
              <Button type="submit" variant="ghost">
                Cancel
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

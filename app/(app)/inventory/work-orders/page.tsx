import type { Metadata } from 'next'
import Link from 'next/link'

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

import { cancelWorkOrder, completeWorkOrder, releaseWorkOrder } from './actions'

export const metadata: Metadata = { title: 'Work orders' }

export default async function WorkOrdersPage() {
  const ctx = await requireOrgContext('inventory:read')
  const rows = await workOrderService.list(ctx)
  const canAdjust = ctx.permissions.has('inventory:adjust')

  return (
    <>
      <PageHeader
        title="Work orders"
        description="Plan an assembly build, release it to the floor, then complete to post stock through the bill of materials."
        actions={
          canAdjust ? (
            <Link href="/inventory/work-orders/new" className={buttonVariants({ size: 'sm' })}>
              New work order
            </Link>
          ) : null
        }
      />

      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <Link href={`/inventory/work-orders/${row.id}`} className="font-medium text-primary hover:underline">
              {row.number}
            </Link>
            <span>
              {row.quantity} {row.item.name}
              {row.store ? ` · ${row.store.name}` : ''} · {row.status}
              {row.build ? ` · build ${row.build.number}` : ''}
            </span>
            {canAdjust && canReleaseWorkOrder(row.status as WorkOrderStatus) ? (
              <form action={releaseWorkOrder}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Release
                </Button>
              </form>
            ) : null}
            {canAdjust && canCompleteWorkOrder(row.status as WorkOrderStatus) ? (
              <form action={completeWorkOrder}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm">
                  Complete
                </Button>
              </form>
            ) : null}
            {canAdjust && canCancelWorkOrder(row.status as WorkOrderStatus) ? (
              <form action={cancelWorkOrder}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Cancel
                </Button>
              </form>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? (
          <Card className="space-y-3 px-4 py-8 text-sm">
            <p className="font-medium text-foreground">No work orders yet</p>
            <p className="text-muted-foreground">
              A work order plans an assembly: draft → release → complete. Completing posts the bill of
              materials and finished goods into stock.
            </p>
            {canAdjust ? (
              <Link href="/inventory/work-orders/new" className={buttonVariants({ size: 'sm' })}>
                Create the first work order
              </Link>
            ) : (
              <p className="text-muted-foreground">You need inventory adjust permission to create one.</p>
            )}
          </Card>
        ) : null}
      </ul>
    </>
  )
}

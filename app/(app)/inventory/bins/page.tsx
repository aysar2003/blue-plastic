import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { WMS_LEGAL, canCancelPick, canCompletePick, canStartPick, type PickStatus } from '@/lib/erp/wms-pick'
import { requireOrgContext } from '@/server/auth/context'
import * as wms from '@/server/services/wms.service'

import { cancelPick, completePick, createBin, createPick, startPick } from './actions'

export const metadata: Metadata = { title: 'Bins & picks' }

export default async function BinsPage() {
  const ctx = await requireOrgContext('inventory:read')
  const board = await wms.listBoard(ctx)
  const canAdjust = ctx.permissions.has('inventory:adjust')

  return (
    <>
      <PageHeader title="Bins & picks" description="Name a bin, then pick stock by hand. Completing a pick issues inventory." />
      <p className="mb-4 max-w-2xl text-xs text-muted-foreground">{WMS_LEGAL}</p>
      {canAdjust ? (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card className="space-y-2 p-4">
            <h2 className="font-medium">New bin</h2>
            <form action={createBin} className="space-y-2">
              <NativeSelect name="storeId" required>
                {board.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </NativeSelect>
              <Input name="code" placeholder="A-01" required />
              <Input name="name" placeholder="Name (optional)" />
              <Button type="submit" size="sm">
                Add bin
              </Button>
            </form>
          </Card>
          <Card className="space-y-2 p-4">
            <h2 className="font-medium">New pick</h2>
            <form action={createPick} className="space-y-2">
              <NativeSelect name="storeId" required>
                {board.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect name="itemId" required>
                {board.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect name="binId">
                <option value="">No bin</option>
                {board.bins.map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.code} · {bin.store.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect name="salesOrderId">
                <option value="">No sales order</option>
                {board.openOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.number}
                  </option>
                ))}
              </NativeSelect>
              <Input name="qty" placeholder="Qty" required />
              <Input name="lotNumber" placeholder="Lot (if tracked)" />
              <Input name="serialNumber" placeholder="Serial (if tracked)" />
              <Button type="submit" size="sm">
                Create pick
              </Button>
            </form>
          </Card>
        </div>
      ) : null}
      <Card className="mb-6 overflow-hidden p-0">
        <ul className="divide-y text-sm">
          {board.bins.map((bin) => (
            <li key={bin.id} className="px-3 py-2">
              {bin.code} · {bin.name} · {bin.store.name}
            </li>
          ))}
          {board.bins.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">No bins yet.</li>
          ) : null}
        </ul>
      </Card>
      <ul className="space-y-2 text-sm">
        {board.picks.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <span>
              {row.qty} {row.item.name} · {row.store.name}
              {row.bin ? ` · ${row.bin.code}` : ''}
              {row.sourceType === 'SALES_ORDER' ? ' · SO' : ''}
              {row.lotNumber ? ` · lot ${row.lotNumber}` : ''}
              {row.serialNumber ? ` · sn ${row.serialNumber}` : ''} · {row.status}
            </span>
            {canAdjust && canStartPick(row.status as PickStatus) ? (
              <form action={startPick}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Start
                </Button>
              </form>
            ) : null}
            {canAdjust && canCompletePick(row.status as PickStatus) ? (
              <form action={completePick}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Picked
                </Button>
              </form>
            ) : null}
            {canAdjust && canCancelPick(row.status as PickStatus) ? (
              <form action={cancelPick}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Cancel
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )
}

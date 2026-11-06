import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { canCancelPutaway, canCompletePutaway, canReleaseWave, type PutawayStatus, type WaveStatus } from '@/lib/erp/wms-bin'
import { WMS_LEGAL, canCancelPick, canCompletePick, canStartPick, type PickStatus } from '@/lib/erp/wms-pick'
import { requireOrgContext } from '@/server/auth/context'
import * as wms from '@/server/services/wms.service'

import {
  cancelPick,
  cancelPutaway,
  cancelWave,
  completePick,
  completePutaway,
  completeWave,
  createBin,
  createPick,
  createPutaway,
  createWave,
  releaseWave,
  startPick,
} from './actions'

export const metadata: Metadata = { title: 'Bins & picks' }

export default async function BinsPage() {
  const ctx = await requireOrgContext('inventory:read')
  const board = await wms.listBoard(ctx)
  const canAdjust = ctx.permissions.has('inventory:adjust')

  return (
    <>
      <PageHeader
        title="Bins & picks"
        description="Bin on-hand, putaway after receive, and wave picks. Completing a pick issues inventory and reduces the bin."
      />
      <p className="mb-4 max-w-2xl text-xs text-muted-foreground">{WMS_LEGAL}</p>

      {canAdjust ? (
        <div className="mb-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
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
            <h2 className="font-medium">Putaway</h2>
            <form action={createPutaway} className="space-y-2">
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
                <option value="">Choose on complete</option>
                {board.bins.map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.code} · {bin.store.name}
                  </option>
                ))}
              </NativeSelect>
              <Input name="qty" placeholder="Qty" required />
              <Button type="submit" size="sm">
                Queue putaway
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
              <NativeSelect name="waveId">
                <option value="">No wave</option>
                {board.waves
                  .filter((w) => w.status === 'OPEN' || w.status === 'RELEASED')
                  .map((wave) => (
                    <option key={wave.id} value={wave.id}>
                      {wave.number}
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
          <Card className="space-y-2 p-4">
            <h2 className="font-medium">New wave</h2>
            <form action={createWave} className="space-y-2">
              <Input name="notes" placeholder="Notes (optional)" />
              <Button type="submit" size="sm">
                Create wave
              </Button>
            </form>
          </Card>
        </div>
      ) : null}

      <h2 className="mb-2 text-sm font-medium">Bin on-hand</h2>
      <Card className="mb-6 overflow-hidden p-0">
        <ul className="divide-y text-sm">
          {board.binBalances.map((row) => (
            <li key={`${row.binId}-${row.itemId}`} className="px-3 py-2">
              {row.binCode} · {row.itemName} · {row.qty}
            </li>
          ))}
          {board.binBalances.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">No bin quantities yet — complete a putaway.</li>
          ) : null}
        </ul>
      </Card>

      <h2 className="mb-2 text-sm font-medium">Putaways</h2>
      <ul className="mb-6 space-y-2 text-sm">
        {board.putaways.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <span>
              {row.qty} {row.item.name} · {row.store.name}
              {row.bin ? ` · ${row.bin.code}` : ''} · {row.status}
            </span>
            {canAdjust && canCompletePutaway(row.status as PutawayStatus) ? (
              <form action={completePutaway} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={row.id} />
                {!row.binId ? (
                  <NativeSelect name="binId" required>
                    {board.bins.map((bin) => (
                      <option key={bin.id} value={bin.id}>
                        {bin.code}
                      </option>
                    ))}
                  </NativeSelect>
                ) : null}
                <Button type="submit" size="sm">
                  Complete
                </Button>
              </form>
            ) : null}
            {canAdjust && canCancelPutaway(row.status as PutawayStatus) ? (
              <form action={cancelPutaway}>
                <input type="hidden" name="id" value={row.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Cancel
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      <h2 className="mb-2 text-sm font-medium">Waves</h2>
      <ul className="mb-6 space-y-2 text-sm">
        {board.waves.map((wave) => (
          <li key={wave.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <span>
              {wave.number} · {wave.status} · {wave._count.picks} picks
            </span>
            {canAdjust && canReleaseWave(wave.status as WaveStatus) ? (
              <form action={releaseWave}>
                <input type="hidden" name="id" value={wave.id} />
                <Button type="submit" size="sm" variant="secondary">
                  Release
                </Button>
              </form>
            ) : null}
            {canAdjust && wave.status === 'RELEASED' ? (
              <form action={completeWave}>
                <input type="hidden" name="id" value={wave.id} />
                <Button type="submit" size="sm">
                  Complete all
                </Button>
              </form>
            ) : null}
            {canAdjust && (wave.status === 'OPEN' || wave.status === 'RELEASED') ? (
              <form action={cancelWave}>
                <input type="hidden" name="id" value={wave.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Cancel
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      <h2 className="mb-2 text-sm font-medium">Picks</h2>
      <ul className="space-y-2 text-sm">
        {board.picks.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
            <span>
              {row.qty} {row.item.name} · {row.store.name}
              {row.bin ? ` · ${row.bin.code}` : ''}
              {row.wave ? ` · ${row.wave.number}` : ''}
              {row.sourceType === 'SALES_ORDER' ? ' · SO' : ''} · {row.status}
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

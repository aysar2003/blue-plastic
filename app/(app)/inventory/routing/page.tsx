import type { Metadata } from 'next'
import Link from 'next/link'

import {
  saveRoutingAction,
  saveWorkCenterAction,
} from '@/app/(app)/inventory/routing/actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as routing from '@/server/services/routing.service'

export const metadata: Metadata = { title: 'Routings' }

export default async function InventoryRoutingPage({
  searchParams,
}: {
  searchParams: Promise<{ itemId?: string }>
}) {
  const ctx = await requireOrgContext('inventory:read')
  const query = await searchParams
  const [items, centers, stores, capacity] = await Promise.all([
    db.item.findMany({
      where: {
        orgId: ctx.orgId,
        isActive: true,
        deletedAt: null,
        type: { in: ['INVENTORY_ASSEMBLY', 'INVENTORY'] },
      },
      select: { id: true, name: true, sku: true },
      orderBy: { name: 'asc' },
      take: 500,
    }),
    routing.listWorkCenters(ctx),
    db.store.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    routing.capacityReport(ctx),
  ])
  const selected = query.itemId || items[0]?.id
  const detail = selected ? await routing.listRouting(ctx, selected) : null

  return (
    <>
      <PageHeader
        title="Routings & capacity"
        description="Operations with work-center minutes, plus open WO load vs weekly capacity. Not a shop-floor MES."
        actions={
          <Link href="/inventory/work-orders" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Work orders
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Work centers</h2>
          <form action={saveWorkCenterAction} className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              Name
              <Input name="name" required className="mt-1 w-40" placeholder="Assembly cell" />
            </label>
            <label className="text-xs">
              Store
              <NativeSelect name="storeId" className="mt-1">
                <option value="">None</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-xs">
              Minutes / week
              <Input
                name="capacityMinutesPerWeek"
                defaultValue="2400"
                className="mt-1 w-28"
              />
            </label>
            {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day) => (
              <label key={day} className="text-xs">
                {day}
                <Input name={`cap_${day}`} className="mt-1 w-16" placeholder="0" />
              </label>
            ))}
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Add center
            </button>
          </form>
          {centers.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {centers.map((center) => center.name).join(' · ')}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="mb-8">
        <h2 className="mb-2 text-sm font-semibold">Capacity load (open WOs)</h2>
        {capacity.length === 0 ? (
          <EmptyState
            title="No capacity to report"
            description="Add a work center with weekly minutes, then open work orders on routed assemblies to see load %."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Center</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Capacity min</TableHead>
                <TableHead className="text-right">Demand min</TableHead>
                <TableHead className="text-right">Load %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {capacity.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.storeName ?? '—'}</TableCell>
                  <TableCell className="text-right tabular">{row.capacityMinutes}</TableCell>
                  <TableCell className="text-right tabular">{row.demandMinutes}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={row.overloaded ? 'destructive' : 'outline'}>
                      {row.loadPercent}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState title="No products" description="Add an assembly or inventory item first." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {items.slice(0, 24).map((item) => (
              <Link
                key={item.id}
                href={`/inventory/routing?itemId=${item.id}`}
                className={buttonVariants({
                  size: 'sm',
                  variant: selected === item.id ? 'default' : 'outline',
                })}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {detail ? (
            <Card>
              <CardContent className="space-y-3 p-4">
                <p className="text-sm text-muted-foreground">
                  {detail.item.name} · total {detail.totalMinutes} minutes
                </p>
                <form action={saveRoutingAction} className="space-y-2">
                  <input type="hidden" name="itemId" value={detail.item.id} />
                  {[0, 1, 2, 3].map((index) => {
                    const step = detail.steps[index]
                    return (
                      <div key={index} className="flex flex-wrap gap-2">
                        <Input
                          name={`name${index}`}
                          placeholder={`Step ${index + 1} name`}
                          defaultValue={step?.name ?? ''}
                          className="w-40"
                        />
                        <Input
                          name={`minutes${index}`}
                          placeholder="Minutes"
                          defaultValue={step?.minutes?.toString() ?? ''}
                          className="w-24"
                        />
                        <NativeSelect
                          name={`workCenterId${index}`}
                          defaultValue={step?.workCenterId ?? ''}
                          className="w-40"
                        >
                          <option value="">No center</option>
                          {centers.map((center) => (
                            <option key={center.id} value={center.id}>
                              {center.name}
                            </option>
                          ))}
                        </NativeSelect>
                        <Input
                          name={`notes${index}`}
                          placeholder="Notes"
                          defaultValue={step?.notes ?? ''}
                          className="min-w-[10rem] flex-1"
                        />
                      </div>
                    )
                  })}
                  <button type="submit" className={buttonVariants({ size: 'sm' })}>
                    Save routing
                  </button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </>
  )
}

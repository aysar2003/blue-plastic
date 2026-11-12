import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as hotel from '@/server/services/hotel.service'

import { addCharge, checkInGuest, checkOutGuest, postNightlyCharges } from '../actions'

export const metadata: Metadata = { title: 'Stays' }

export default async function HospitalityStaysPage() {
  const ctx = await requireOrgContext('invoice:read')
  const [stays, rooms, customers, items] = await Promise.all([
    hotel.listOpenStays(ctx),
    hotel.listRooms(ctx),
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 200,
    }),
    db.item.findMany({
      where: { orgId: ctx.orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true, salesPrice: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ])
  const canEdit = ctx.permissions.has('invoice:create')
  const vacant = rooms.filter((room) => room.status === 'VACANT' || room.status === 'CLEAN')

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <PageHeader
        title="Stays"
        description="Check in a guest, add folio charges, post nightly room rates, check out to a sales invoice."
      />

      {canEdit ? (
        <form action={postNightlyCharges} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="nightOf">Post nightly rates for</Label>
            <Input id="nightOf" name="nightOf" type="date" />
          </div>
          <Button type="submit" variant="secondary">
            Post room nights
          </Button>
        </form>
      ) : null}

      {canEdit ? (
        <form action={checkInGuest} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="roomId">Room</Label>
            <select
              id="roomId"
              name="roomId"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {vacant.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.code} · {room.roomType.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="customerId">Guest</Label>
            <select
              id="customerId"
              name="customerId"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={vacant.length === 0 || customers.length === 0}>
              Check in
            </Button>
          </div>
        </form>
      ) : null}

      <ul className="space-y-4">
        {stays.map((stay) => {
          const balance = hotel.folioBalance(stay.folio?.lines ?? [])
          return (
            <li key={stay.id} className="rounded-lg border p-4 text-sm">
              <p className="font-medium">
                {stay.room.code} · {stay.customer.displayName}
              </p>
              <p className="text-xs text-muted-foreground">
                Folio balance {balance} · {stay.folio?.lines.length ?? 0} charges
              </p>

              {canEdit && stay.folio ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <form action={addCharge} className="space-y-2 rounded-md border p-3">
                    <input type="hidden" name="folioId" value={stay.folio.id} />
                    <Label>Add charge</Label>
                    <select name="itemId" required className="flex h-9 w-full rounded-md border px-2 text-sm">
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <Input name="description" required placeholder="Description" />
                    <div className="flex gap-2">
                      <Input name="quantity" defaultValue="1" />
                      <Input
                        name="unitPrice"
                        defaultValue={items[0]?.salesPrice?.toString() ?? '0'}
                      />
                    </div>
                    <Button type="submit" size="sm" variant="secondary">
                      Add
                    </Button>
                  </form>
                  <form action={checkOutGuest} className="flex items-end">
                    <input type="hidden" name="stayId" value={stay.id} />
                    <Button type="submit">Check out → invoice</Button>
                  </form>
                </div>
              ) : null}
            </li>
          )
        })}
        {stays.length === 0 ? (
          <li className="text-sm text-muted-foreground">No open stays.</li>
        ) : null}
      </ul>
    </div>
  )
}

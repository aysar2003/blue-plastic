import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as hotel from '@/server/services/hotel.service'

import { saveRoom, saveRoomType, setHousekeeping } from '../actions'

export const metadata: Metadata = { title: 'Rooms' }

export default async function HospitalityRoomsPage() {
  const ctx = await requireOrgContext('invoice:read')
  const [types, rooms, items] = await Promise.all([
    hotel.listRoomTypes(ctx),
    hotel.listRooms(ctx),
    db.item.findMany({
      where: { orgId: ctx.orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ])
  const canEdit = ctx.permissions.has('invoice:create')

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <PageHeader title="Rooms" description="Room types, rooms, and housekeeping status." />

      {canEdit ? (
        <>
          <form action={saveRoomType} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="typeName">Room type</Label>
              <Input id="typeName" name="name" required placeholder="Standard twin" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="baseRateItemId">Rate item</Label>
              <select
                id="baseRateItemId"
                name="baseRateItemId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">None</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit">Add type</Button>
            </div>
          </form>

          <form action={saveRoom} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="roomTypeId">Type</Label>
              <select
                id="roomTypeId"
                name="roomTypeId"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" required placeholder="101" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="floor">Floor</Label>
              <Input id="floor" name="floor" placeholder="1" />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={types.length === 0}>
                Add room
              </Button>
            </div>
          </form>
        </>
      ) : null}

      <ul className="space-y-3">
        {rooms.map((room) => (
          <li key={room.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <div>
              <p className="font-medium">
                {room.code} · {room.roomType.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {room.status}
                {room.floor ? ` · floor ${room.floor}` : ''}
              </p>
            </div>
            {canEdit && room.status !== 'OCCUPIED' ? (
              <form action={setHousekeeping} className="flex items-center gap-2">
                <input type="hidden" name="roomId" value={room.id} />
                <select name="status" defaultValue={room.status} className="h-9 rounded-md border px-2 text-sm">
                  <option value="VACANT">Vacant</option>
                  <option value="CLEAN">Clean</option>
                  <option value="DIRTY">Dirty</option>
                  <option value="OOO">OOO</option>
                </select>
                <Button type="submit" size="sm" variant="secondary">
                  Set
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

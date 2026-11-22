import type { Metadata } from 'next'
import Link from 'next/link'

import {
  allocateHostelAction,
  saveHostelBlockAction,
  saveHostelRoomAction,
} from '@/app/(app)/education/ops-actions'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireOrgContext } from '@/server/auth/context'
import * as ops from '@/server/services/school-ops.service'

export const metadata: Metadata = { title: 'Hostel' }

export default async function EducationHostelPage() {
  const ctx = await requireOrgContext('invoice:read')
  const [blocks, enrollments] = await Promise.all([
    ops.listHostel(ctx),
    ops.activeEnrollmentsOptions(ctx),
  ])
  const rooms = blocks.flatMap((block) =>
    block.rooms.map((room) => ({
      ...room,
      blockName: block.name,
      occupied: room._count.allocations,
    })),
  )

  return (
    <>
      <PageHeader
        title="Hostel"
        description="Boarding blocks, rooms, capacity, and bed allocations."
        actions={
          <Link href="/education" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Education hub
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add block</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveHostelBlockAction} className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                Name
                <Input name="name" required className="mt-1 w-48" placeholder="Boys A" />
              </label>
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Save block
              </button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add room</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveHostelRoomAction} className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                Block
                <select
                  name="blockId"
                  required
                  className="mt-1 block h-9 w-40 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {blocks.map((block) => (
                    <option key={block.id} value={block.id}>
                      {block.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Room
                <Input name="name" required className="mt-1 w-28" placeholder="R12" />
              </label>
              <label className="text-sm">
                Capacity
                <Input name="capacity" type="number" min={1} defaultValue={4} className="mt-1 w-24" />
              </label>
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Save room
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Allocate bed</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={allocateHostelAction} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Room
              <select
                name="roomId"
                required
                className="mt-1 block h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.blockName} / {room.name} ({room.occupied}/{room.capacity})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Student
              <select
                name="enrollmentId"
                required
                className="mt-1 block h-9 w-64 rounded-md border border-input bg-background px-2 text-sm"
              >
                {enrollments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Bed
              <Input name="bedLabel" className="mt-1 w-24" placeholder="B1" />
            </label>
            <button type="submit" className={buttonVariants({ size: 'sm' })}>
              Allocate
            </button>
          </form>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Block</TableHead>
            <TableHead>Room</TableHead>
            <TableHead className="text-right">Occupied</TableHead>
            <TableHead className="text-right">Capacity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rooms.map((room) => (
            <TableRow key={room.id}>
              <TableCell>{room.blockName}</TableCell>
              <TableCell className="font-medium">{room.name}</TableCell>
              <TableCell className="text-right tabular-nums">{room.occupied}</TableCell>
              <TableCell className="text-right tabular-nums">{room.capacity}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}

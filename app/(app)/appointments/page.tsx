import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { requireOrgContext } from '@/server/auth/context'
import * as collab from '@/server/services/collab.service'

import { bookAppointment, createAppointmentType, setAppointmentStatus } from './actions'

export const metadata: Metadata = { title: 'Appointments' }

export default async function AppointmentsPage() {
  const ctx = await requireOrgContext('calendar:read')
  const [rows, types] = await Promise.all([
    collab.listAppointments(ctx),
    collab.listAppointmentTypes(ctx),
  ])

  let typeOptions = types
  if (typeOptions.length === 0) {
    await collab.ensureAppointmentType(ctx, 'Meeting', 30)
    typeOptions = await collab.listAppointmentTypes(ctx)
  }

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Bookable slots with overlap checks. Booked items also appear on Calendar."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/calendar">Calendar</Link>
          </Button>
        }
      />
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-medium">Book a slot</h2>
          <form action={bookAppointment} className="space-y-3">
            <div>
              <Label htmlFor="typeId">Type</Label>
              <NativeSelect id="typeId" name="typeId" required className="mt-1">
                {typeOptions.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.durationMins} min)
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="startsAt">Starts</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="endsAt">Ends</Label>
              <Input id="endsAt" name="endsAt" type="datetime-local" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="guestName">Guest</Label>
              <Input id="guestName" name="guestName" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" className="mt-1" />
            </div>
            <Button type="submit" size="sm">
              Book
            </Button>
          </form>
        </Card>
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-medium">Appointment types</h2>
          <form action={createAppointmentType} className="space-y-3">
            <div>
              <Label htmlFor="typeName">Name</Label>
              <Input id="typeName" name="name" required className="mt-1" placeholder="Site visit" />
            </div>
            <div>
              <Label htmlFor="durationMins">Duration (minutes)</Label>
              <Input
                id="durationMins"
                name="durationMins"
                type="number"
                min={5}
                max={480}
                defaultValue={30}
                required
                className="mt-1"
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Add type
            </Button>
          </form>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {typeOptions.map((type) => (
              <li key={type.id}>
                {type.name} · {type.durationMins} min
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {row.type.name} · {row.startsAt.toISOString().slice(0, 16).replace('T', ' ')}
                {row.guestName ? ` · ${row.guestName}` : ''}
                {row.customer ? ` · ${row.customer.displayName}` : ''}
              </span>
              <span className="text-muted-foreground">{row.status}</span>
            </div>
            {row.status === 'BOOKED' ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <form action={setAppointmentStatus}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="status" value="COMPLETED" />
                  <Button type="submit" size="sm" variant="secondary">
                    Complete
                  </Button>
                </form>
                <form action={setAppointmentStatus}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="status" value="NO_SHOW" />
                  <Button type="submit" size="sm" variant="outline">
                    No-show
                  </Button>
                </form>
                <form action={setAppointmentStatus}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="status" value="CANCELLED" />
                  <Button type="submit" size="sm" variant="ghost">
                    Cancel
                  </Button>
                </form>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )
}

import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { isCalendarDate, startOfMonth, today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as calendarService from '@/server/services/calendar.service'
import { CalendarBoard } from './calendar-board'

export const metadata: Metadata = { title: 'Calendar' }

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('calendar:read')
  const params = await searchParams
  const zone = ctx.organization.timeZone
  const todayDate = today(zone)
  const monthParam = typeof params.month === 'string' ? params.month : ''
  const month =
    isCalendarDate(monthParam) ? startOfMonth(monthParam) : calendarService.defaultMonth(zone)

  const [events, upcoming] = await Promise.all([
    calendarService.listInMonth(ctx, month),
    calendarService.upcoming(ctx, 14),
  ])

  const serialize = (row: (typeof events)[number]) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    kind: row.kind,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    allDay: row.allDay,
    reminderMinutes: row.reminderMinutes,
    customerId: row.customerId,
    vendorId: row.vendorId,
    customerName: row.customerName,
    vendorName: row.vendorName,
    createdByName: row.createdByName,
  })

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Meetings, appointments, and reminders for the business — schedule them here and get reminded in the top bar when the time comes."
      />
      <CalendarBoard
        month={month}
        today={todayDate}
        timeZone={zone}
        events={events.map(serialize)}
        upcoming={upcoming.map(serialize)}
        canCreate={ctx.permissions.has('calendar:create')}
        canEdit={ctx.permissions.has('calendar:update')}
        canDelete={ctx.permissions.has('calendar:delete')}
      />
    </>
  )
}

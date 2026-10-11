'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import {
  addDays,
  addMonths,
  calendarDateInZone,
  clockInZone,
  endOfMonth,
  formatDateTime,
  startOfMonth,
  type CalendarDate,
} from '@/lib/date'
import { CALENDAR_KIND_LABELS, type CalendarKind } from '@/lib/validation/calendar'
import { cn } from '@/lib/utils'
import { EventDialog, NewEventButton, type EventFormValues } from './event-dialog'

export type BoardEvent = {
  id: string
  title: string
  description: string | null
  location: string | null
  kind: string
  startsAt: string
  endsAt: string
  allDay: boolean
  reminderMinutes: number | null
  customerId: string | null
  vendorId: string | null
  customerName: string | null
  vendorName: string | null
  createdByName: string
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const KIND_TONE: Record<string, string> = {
  meeting: 'bg-sky-100 text-sky-900 ring-sky-200',
  appointment: 'bg-teal-100 text-teal-900 ring-teal-200',
  reminder: 'bg-amber-100 text-amber-950 ring-amber-200',
}

function mondayOfWeek(date: CalendarDate): CalendarDate {
  const [y, m, d] = date.split('-').map(Number)
  const utc = new Date(Date.UTC(y!, m! - 1, d))
  const day = utc.getUTCDay() // 0 Sun … 6 Sat
  const back = day === 0 ? 6 : day - 1
  utc.setUTCDate(utc.getUTCDate() - back)
  return utc.toISOString().slice(0, 10)
}

function monthCells(month: CalendarDate): CalendarDate[] {
  const start = mondayOfWeek(startOfMonth(month))
  const end = endOfMonth(month)
  const lastMonday = mondayOfWeek(end)
  const gridEnd = addDays(lastMonday, 6)
  const cells: CalendarDate[] = []
  let cursor = start
  while (cursor <= gridEnd) {
    cells.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return cells
}

export function CalendarBoard({
  month,
  today,
  timeZone,
  events,
  upcoming,
  canCreate,
  canEdit,
  canDelete,
}: {
  month: CalendarDate
  today: CalendarDate
  timeZone: string
  events: BoardEvent[]
  upcoming: BoardEvent[]
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}) {
  const [draft, setDraft] = useState<EventFormValues | null>(null)
  const prefix = month.slice(0, 7)
  const cells = useMemo(() => monthCells(month), [month])
  const byDay = useMemo(() => {
    const map = new Map<string, BoardEvent[]>()
    for (const event of events) {
      const start = new Date(event.startsAt)
      const end = new Date(event.endsAt)
      let day = calendarDateInZone(start, timeZone)
      const last = event.allDay
        ? calendarDateInZone(new Date(end.getTime() - 1), timeZone)
        : calendarDateInZone(start, timeZone)
      while (day <= last) {
        const list = map.get(day) ?? []
        list.push(event)
        map.set(day, list)
        day = addDays(day, 1)
      }
    }
    return map
  }, [events, timeZone])

  const title = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}T00:00:00.000Z`))

  const openCreate = (date: CalendarDate) => {
    if (!canCreate) return
    setDraft({
      title: '',
      description: '',
      location: '',
      kind: 'meeting',
      date,
      startTime: '09:00',
      endTime: '10:00',
      allDay: false,
      reminderMinutes: 15,
      customerId: null,
      vendorId: null,
    })
  }

  const openEdit = (event: BoardEvent) => {
    if (!canEdit) return
    const start = new Date(event.startsAt)
    const end = new Date(event.endsAt)
    setDraft({
      id: event.id,
      title: event.title,
      description: event.description ?? '',
      location: event.location ?? '',
      kind: event.kind,
      date: calendarDateInZone(start, timeZone),
      startTime: event.allDay ? '09:00' : clockInZone(start, timeZone),
      endTime: event.allDay ? '17:00' : clockInZone(end, timeZone),
      allDay: event.allDay,
      reminderMinutes: event.reminderMinutes,
      customerId: event.customerId,
      vendorId: event.vendorId,
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-1">
            <Link
              href={`/calendar?month=${addMonths(month, -1)}`}
              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
              aria-label="Previous month"
            >
              <ChevronLeftIcon className="size-4" />
            </Link>
            <Link
              href={`/calendar?month=${addMonths(month, 1)}`}
              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
              aria-label="Next month"
            >
              <ChevronRightIcon className="size-4" />
            </Link>
          </div>
          <h2 className="text-base font-semibold">{title}</h2>
          <Link
            href={`/calendar?month=${startOfMonth(today)}`}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Today
          </Link>
          <div className="ml-auto">
            <NewEventButton defaultDate={today} canCreate={canCreate} />
          </div>
        </div>

        <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-1 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[minmax(6.5rem,1fr)]">
          {cells.map((day) => {
            const inMonth = day.startsWith(prefix)
            const dayEvents = byDay.get(day) ?? []
            return (
              <div
                key={day}
                className={cn(
                  'min-h-[6.5rem] border-b border-r p-1.5',
                  !inMonth && 'bg-muted/20 text-muted-foreground',
                  day === today && 'bg-primary/5',
                )}
              >
                <button
                  type="button"
                  onClick={() => openCreate(day)}
                  className={cn(
                    'mb-1 flex size-7 items-center justify-center rounded-full text-xs tabular',
                    day === today && 'bg-primary font-semibold text-primary-foreground',
                    canCreate && 'hover:bg-muted',
                  )}
                  title={canCreate ? `Add event on ${day}` : day}
                >
                  {Number(day.slice(8))}
                </button>
                <ul className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <li key={`${day}-${event.id}`}>
                      <button
                        type="button"
                        onClick={() => openEdit(event)}
                        className={cn(
                          'w-full truncate rounded px-1 py-0.5 text-left text-[0.7rem] ring-1 ring-inset',
                          KIND_TONE[event.kind] ?? KIND_TONE.meeting,
                        )}
                        title={event.title}
                      >
                        {event.allDay ? null : (
                          <span className="mr-1 tabular opacity-80">
                            {clockInZone(new Date(event.startsAt), timeZone)}
                          </span>
                        )}
                        {event.title}
                      </button>
                    </li>
                  ))}
                  {dayEvents.length > 3 ? (
                    <li className="px-1 text-[0.65rem] text-muted-foreground">
                      +{dayEvents.length - 3} more
                    </li>
                  ) : null}
                </ul>
              </div>
            )
          })}
        </div>
      </Card>

      <aside className="space-y-3">
        <Card className="p-3">
          <h3 className="mb-2 text-sm font-semibold">Coming up</h3>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No meetings or appointments scheduled. Add one with New event.
            </p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => openEdit(event)}
                    className="w-full rounded-md border px-2.5 py-2 text-left hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {CALENDAR_KIND_LABELS[event.kind as CalendarKind] ?? event.kind}
                      {' · '}
                      {event.allDay
                        ? calendarDateInZone(new Date(event.startsAt), timeZone)
                        : formatDateTime(new Date(event.startsAt), timeZone)}
                    </p>
                    {event.location ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{event.location}</p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-3 text-xs text-muted-foreground">
          Click a day to schedule. Reminders appear in the top bar when their time arrives — same idea as
          Odoo’s calendar.
        </Card>
      </aside>

      {draft ? (
        <EventDialog
          initial={draft}
          canDelete={canDelete && Boolean(draft.id)}
          onClose={() => setDraft(null)}
        />
      ) : null}
    </div>
  )
}

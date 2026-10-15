'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { CalendarClockIcon } from 'lucide-react'
import { toast } from 'sonner'

import { dismissCalendarReminder } from '@/app/(app)/calendar/actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CALENDAR_KIND_LABELS, type CalendarKind } from '@/lib/validation/calendar'

export type CalendarAlertItem = {
  id: string
  title: string
  kind: string
  when: string
}

/** Shell bell for meetings and appointments whose reminder time has arrived. */
export function CalendarAlerts({ alerts }: { alerts: CalendarAlertItem[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-[var(--band)] hover:text-foreground"
        aria-label={alerts.length > 0 ? `Calendar reminders, ${alerts.length}` : 'Calendar reminders'}
      >
        <CalendarClockIcon className="size-4" />
        {alerts.length > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-[#0369a1] px-1 text-[0.65rem] font-semibold text-white">
            {alerts.length}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <p className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Calendar reminders
        </p>
        {alerts.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">No upcoming reminders right now.</p>
        ) : (
          <ul className="max-h-80 overflow-auto py-1">
            {alerts.map((alert) => (
              <li key={alert.id} className="border-b last:border-0">
                <DropdownMenuItem asChild className="items-start px-3 py-2">
                  <Link href={`/calendar?event=${alert.id}`} className="flex flex-col gap-0.5">
                    <span className="font-medium">{alert.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {CALENDAR_KIND_LABELS[alert.kind as CalendarKind] ?? alert.kind}
                      {' · '}
                      {alert.when}
                    </span>
                  </Link>
                </DropdownMenuItem>
                <button
                  type="button"
                  disabled={pending}
                  className="w-full px-3 pb-2 text-left text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await dismissCalendarReminder({ id: alert.id })
                      if (result.ok) {
                        toast.success('Reminder dismissed.')
                        router.refresh()
                      } else {
                        toast.error(result.error.message)
                      }
                    })
                  }
                >
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t px-3 py-2">
          <Link href="/calendar" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Open calendar
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

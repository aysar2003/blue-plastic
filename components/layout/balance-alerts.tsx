'use client'

import Link from 'next/link'
import { BellIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { BalanceAlert } from '@/lib/balance-alert'

/** The top warning for balances whose reminder, or whose balance time, has arrived. */
export function BalanceAlerts({ alerts }: { alerts: BalanceAlert[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative grid size-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
        aria-label={alerts.length > 0 ? `Balance reminders, ${alerts.length}` : 'Balance reminders'}
      >
        <BellIcon className="size-4" />
        {alerts.length > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-[#9f1239] px-1 text-[0.65rem] font-semibold text-white">
            {alerts.length}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <p className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Balance reminders
        </p>
        {alerts.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">No balance has reached its reminder yet.</p>
        ) : (
          <ul className="max-h-80 overflow-auto py-1">
            {alerts.map((alert) => (
              <li key={alert.customerId}>
                <DropdownMenuItem asChild className="items-start px-3 py-2">
                  <Link href={`/customers?id=${alert.customerId}`} className="flex flex-col gap-0.5">
                    <span className="font-medium">{alert.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {alert.kind === 'reached'
                        ? `Balance time reached · ${alert.when}`
                        : `${alert.reminderDays}-day reminder · ${alert.when}`}
                    </span>
                    <span className="tabular text-sm">{alert.amount}</span>
                  </Link>
                </DropdownMenuItem>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

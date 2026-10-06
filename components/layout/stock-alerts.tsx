'use client'

import Link from 'next/link'
import { PackageIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { StockAlert } from '@/lib/stock-alert'

/** Out of stock, and products that have reached the reorder limit. */
export function StockAlerts({ alerts, total }: { alerts: StockAlert[]; total: number }) {
  // `alerts` may be a capped list; `total` is the true number of products.
  const count = Math.max(total, alerts.length)
  const shown = alerts.slice(0, 12)
  const rest = count - shown.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative grid size-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
        aria-label={count > 0 ? `Stock warnings, ${count}` : 'Stock warnings'}
      >
        <PackageIcon className="size-4" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-[#9f1239] px-1 text-[0.65rem] font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <p className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Stock warnings
        </p>
        {count === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Nothing is out of stock or at its reorder limit.</p>
        ) : (
          <ul className="max-h-80 overflow-auto py-1">
            {shown.map((alert) => (
              <li key={alert.itemId}>
                <DropdownMenuItem asChild className="items-start px-3 py-2">
                  <Link href={`/inventory/stock?alert=${alert.kind}`} className="flex flex-col gap-0.5">
                    <span className="font-medium">{alert.name}</span>
                    <span className={alert.kind === 'out' ? 'text-xs font-medium text-[#9f1239]' : 'text-xs text-[#C2410C]'}>
                      {alert.kind === 'out'
                        ? `Out of stock · ${alert.quantity} on hand`
                        : `Reached the limit of ${alert.reorderPoint} · ${alert.quantity} on hand`}
                    </span>
                  </Link>
                </DropdownMenuItem>
              </li>
            ))}
            {rest > 0 ? (
              <li>
                <DropdownMenuItem asChild>
                  <Link href="/inventory/stock?alert=out" className="px-3 py-2 text-sm text-primary">
                    {rest} more
                  </Link>
                </DropdownMenuItem>
              </li>
            ) : null}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

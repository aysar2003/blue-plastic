'use client'

import Link from 'next/link'
import { LayoutGridIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { HeaderMenuItem } from './header-app-menus'
import { LAUNCHER_ICONS } from './launcher-icon-map'

/**
 * QuickBooks Online–style destinations list: icon mark + label for each
 * existing app destination. Used when a side-rail app icon is opened.
 */
export function AppDestinationsPanel({
  appLabel,
  appHref,
  items,
  onDone,
}: {
  appLabel: string
  appHref: string
  items: HeaderMenuItem[]
  onDone: () => void
}) {
  return (
    <div
      role="menu"
      aria-label={`${appLabel} apps`}
      className="max-h-[calc(100vh-1rem)] w-[17.5rem] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_8px_28px_-8px_rgba(15,23,42,0.28)] ring-1 ring-black/5"
    >
      <div className="sticky top-0 z-10 border-b border-border bg-popover px-3 py-2">
        <Link
          href={appHref}
          role="menuitem"
          onClick={onDone}
          className="flex items-center gap-2 text-xs font-bold text-foreground hover:underline"
        >
          <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
            <LayoutGridIcon className="size-3.5" aria-hidden />
          </span>
          <span className="truncate">{appLabel} home</span>
        </Link>
      </div>
      <ul className="overflow-y-auto overscroll-contain py-1.5">
        {items.map((item) => (
          <li key={`${item.href ?? item.label}-${item.label}`}>
            <DestinationRow item={item} fallbackHref={appHref} onDone={onDone} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DestinationRow({
  item,
  fallbackHref,
  onDone,
  dense = false,
}: {
  item: HeaderMenuItem
  fallbackHref: string
  onDone: () => void
  dense?: boolean
}) {
  const Icon = item.icon ? LAUNCHER_ICONS[item.icon] : null
  return (
    <Link
      href={item.href ?? fallbackHref}
      role="menuitem"
      onClick={onDone}
      className={cn(
        'flex items-center gap-2.5 px-3 hover:bg-muted',
        dense ? 'py-1.5' : 'py-2',
      )}
    >
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-md',
          dense ? 'size-6' : 'size-7',
          !item.wash && 'bg-muted text-muted-foreground',
        )}
        style={
          item.wash && item.accent
            ? { backgroundColor: item.wash, color: item.accent }
            : undefined
        }
      >
        {Icon ? (
          <Icon className="size-3.5" strokeWidth={2} aria-hidden />
        ) : (
          <LayoutGridIcon className="size-3.5" aria-hidden />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-foreground">{item.label}</span>
        {item.blurb && !dense ? (
          <span className="block truncate text-[0.65rem] leading-snug text-muted-foreground">
            {item.blurb}
          </span>
        ) : null}
      </span>
    </Link>
  )
}

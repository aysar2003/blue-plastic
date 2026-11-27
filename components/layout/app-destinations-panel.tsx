'use client'

import Link from 'next/link'
import { LayoutGridIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { HeaderMenuItem } from './header-app-menus'
import { LAUNCHER_ICONS } from './launcher-icon-map'

/**
 * Modern destinations flyout: icon mark + label for each app destination.
 * Opens beside the side rail when hovering Sales (and other apps).
 * Height comes from the portaled shell — the list scrolls inside, nothing clips.
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
      className="flex h-full min-h-0 max-h-[inherit] w-[18rem] max-w-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-[0_16px_40px_-16px_rgba(15,23,42,0.45)] ring-1 ring-black/5"
    >
      <div className="shrink-0 border-b border-border/70 bg-gradient-to-b from-muted/40 to-popover px-3.5 py-3">
        <Link
          href={appHref}
          role="menuitem"
          onClick={onDone}
          className="group flex items-center gap-2.5 rounded-xl px-1 py-0.5 text-foreground transition-colors hover:bg-muted/60"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-primary/12 text-primary shadow-sm ring-1 ring-primary/15 transition-transform group-hover:scale-[1.03]">
            <LayoutGridIcon className="size-3.5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.8125rem] font-semibold tracking-tight">
              {appLabel}
            </span>
            <span className="block text-[0.65rem] text-muted-foreground">Open home</span>
          </span>
        </Link>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
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
        'flex items-center gap-2.5 rounded-xl px-2.5 transition-colors hover:bg-muted/80',
        dense ? 'py-1.5' : 'py-2',
      )}
    >
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-lg shadow-sm ring-1 ring-black/5',
          dense ? 'size-6' : 'size-8',
          !item.wash && 'bg-muted text-muted-foreground',
          item.wash && item.accent && 'app-chroma-chip',
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

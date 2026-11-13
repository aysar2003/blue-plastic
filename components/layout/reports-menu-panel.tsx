'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRightIcon, LayoutGridIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { HeaderMenuItem } from './header-app-menus'
import { LAUNCHER_ICONS } from './launcher-icon-map'

/**
 * QuickBooks Desktop–style Report menu: categories expand to show the reports
 * inside them. Flat links (All reports, Favourites) stay at the top.
 */
export function ReportsMenuPanel({
  items,
  onDone,
  withIcons = false,
}: {
  items: HeaderMenuItem[]
  onDone: () => void
  /** Side rail / QBO-style rows with the catalogue tile icons. */
  withIcons?: boolean
}) {
  const [openLabel, setOpenLabel] = useState<string | null>(null)

  const top = items.filter((item) => !item.children?.length)
  const groups = items.filter((item) => (item.children?.length ?? 0) > 0)

  return (
    <ul className="w-[18rem] bg-popover py-1.5 text-popover-foreground">
      {top.map((item) => (
        <li key={`top-${item.href}-${item.label}`}>
          {withIcons ? (
            <ReportIconLink item={item} onDone={onDone} />
          ) : (
            <Link
              href={item.href!}
              role="menuitem"
              onClick={onDone}
              className="block px-3 py-1.5 hover:bg-muted"
            >
              <span className="block text-xs font-semibold text-foreground">{item.label}</span>
              {item.blurb ? (
                <span className="block text-[0.65rem] leading-snug text-muted-foreground">
                  {item.blurb}
                </span>
              ) : null}
            </Link>
          )}
        </li>
      ))}

      {groups.length > 0 && top.length > 0 ? (
        <li className="my-1 border-t border-border" aria-hidden />
      ) : null}

      {groups.map((group) => {
        const open = openLabel === group.label
        return (
          <li key={`group-${group.label}`}>
            <button
              type="button"
              role="menuitem"
              aria-expanded={open}
              onClick={() => setOpenLabel((current) => (current === group.label ? null : group.label))}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left hover:bg-muted"
            >
              <ChevronRightIcon
                className={cn(
                  'size-3.5 shrink-0 text-muted-foreground transition-transform',
                  open && 'rotate-90',
                )}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-foreground">{group.label}</span>
                {group.blurb ? (
                  <span className="block text-[0.65rem] leading-snug text-muted-foreground">
                    {group.blurb}
                  </span>
                ) : null}
              </span>
            </button>
            {open ? (
              <ul className="border-l border-border/80 pb-1 ml-3 mr-1">
                {group.children!.map((child) => (
                  <li key={`${group.label}-${child.href}-${child.label}`}>
                    {withIcons ? (
                      <ReportIconLink item={child} onDone={onDone} dense />
                    ) : (
                      <Link
                        href={child.href!}
                        role="menuitem"
                        onClick={onDone}
                        className="block px-3 py-1 hover:bg-muted"
                      >
                        <span className="block text-xs font-medium text-foreground">
                          {child.label}
                        </span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function ReportIconLink({
  item,
  onDone,
  dense = false,
}: {
  item: HeaderMenuItem
  onDone: () => void
  dense?: boolean
}) {
  const Icon = item.icon ? LAUNCHER_ICONS[item.icon] : LayoutGridIcon
  return (
    <Link
      href={item.href!}
      role="menuitem"
      onClick={onDone}
      className={cn('flex items-center gap-2.5 px-3 hover:bg-muted', dense ? 'py-1' : 'py-1.5')}
    >
      <span
        className="grid size-6 shrink-0 place-items-center rounded-md"
        style={
          item.wash && item.accent
            ? { backgroundColor: item.wash, color: item.accent }
            : undefined
        }
      >
        <Icon className="size-3.5" strokeWidth={2} aria-hidden />
      </span>
      <span className="min-w-0 truncate text-xs font-semibold text-foreground">{item.label}</span>
    </Link>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import type { NavTab } from './nav-items'

/**
 * Horizontal tabs for a module (Sales, Purchases, …) — same role as the
 * accounting side list, but as a strip under the apps bar.
 */
export function ModuleTabs({
  tabs,
  permissions,
}: {
  tabs: NavTab[]
  permissions: string[]
}) {
  const pathname = usePathname()
  const allowed = new Set(permissions)
  const visible = tabs.filter((tab) => !tab.permission || allowed.has(tab.permission))

  function isActive(tab: NavTab) {
    const prefixes = [tab.href, ...(tab.also ?? [])]
    return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  }

  // Prefer the longest matching prefix so /sales/estimates wins over /sales.
  let activeHref: string | null = null
  let best = -1
  for (const tab of visible) {
    for (const prefix of [tab.href, ...(tab.also ?? [])]) {
      if (
        (pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
        prefix.length > best
      ) {
        best = prefix.length
        activeHref = tab.href
      }
    }
  }

  return (
    <nav
      className="flex gap-0.5 overflow-x-auto px-3 py-1.5 sm:px-6"
      aria-label="Module sections"
    >
      {visible.map((tab) => {
        const on = activeHref === tab.href || (activeHref === null && isActive(tab))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-sm transition',
              on
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

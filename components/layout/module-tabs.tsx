'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { NavTab } from './nav-items'

/**
 * Header strip for the open app only — Bills / Vendors / … under Purchases.
 * System-wide app switching stays in the sidebar (or top apps row when chosen).
 */
export function ModuleTabs({
  appLabel,
  appHref,
  tabs,
  permissions,
}: {
  appLabel?: string
  appHref?: string
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

  const scrollerRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) return
    const measure = () => {
      const max = node.scrollWidth - node.clientWidth
      setEdges({
        left: node.scrollLeft > 4,
        right: max > 4 && node.scrollLeft < max - 4,
      })
    }
    measure()
    node.addEventListener('scroll', measure, { passive: true })
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(node)
    return () => {
      node.removeEventListener('scroll', measure)
      observer?.disconnect()
    }
  }, [visible.length, pathname])

  const nudge = (direction: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: direction * 220, behavior: 'smooth' })
  }

  return (
    <div className="flex items-center">
      {edges.left ? (
        <button
          type="button"
          className="grid size-8 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
          aria-label="Earlier sections"
          onClick={() => nudge(-1)}
        >
          <ChevronLeftIcon className="size-4" />
        </button>
      ) : null}
    <nav
      ref={scrollerRef}
      className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-3 py-1.5 sm:px-6"
      aria-label={appLabel ? `${appLabel} sections` : 'Module sections'}
    >
      {appLabel && appHref ? (
        <>
          <Link
            href={appHref}
            className="shrink-0 rounded-md px-2.5 py-1.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            {appLabel}
          </Link>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
        </>
      ) : null}
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
      {edges.right ? (
        <button
          type="button"
          className="grid size-8 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
          aria-label="Later sections"
          onClick={() => nudge(1)}
        >
          <ChevronRightIcon className="size-4" />
        </button>
      ) : null}
    </div>
  )
}

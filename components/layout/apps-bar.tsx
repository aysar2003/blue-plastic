'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  LayoutGridIcon,
  PanelLeftIcon,
} from 'lucide-react'

import { appForPath } from '@/lib/app-memory'
import { APP_ALSO, appsForPermissions } from './launcher-apps'

/** Remembered in this browser so the icon row stays hidden after a reload. */
export const APPS_BAR_STORAGE_KEY = 'bp.apps-bar.hidden'

/** Top icon row (default) or left icon rail — try either, switch back anytime. */
export const APPS_NAV_LAYOUT_KEY = 'bp.apps-nav.layout'
export type AppsNavLayout = 'top' | 'side'

export function useAppsBarHidden() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage only after hydration so server and client markup match
      setHidden(window.localStorage.getItem(APPS_BAR_STORAGE_KEY) === '1')
    } catch {
      setHidden(false)
    }
  }, [])

  function toggle() {
    setHidden((current) => {
      const next = !current
      try {
        window.localStorage.setItem(APPS_BAR_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // The choice still applies for this visit if storage is blocked.
      }
      return next
    })
  }

  return { hidden, toggle }
}

export function useAppsNavLayout() {
  // Default: system apps on the left; the open app’s sections stay in the header.
  const [layout, setLayout] = useState<AppsNavLayout>('side')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(APPS_NAV_LAYOUT_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage only after hydration so server and client markup match
      setLayout(saved === 'top' ? 'top' : 'side')
    } catch {
      setLayout('side')
    }
  }, [])

  function setNavLayout(next: AppsNavLayout) {
    setLayout(next)
    try {
      window.localStorage.setItem(APPS_NAV_LAYOUT_KEY, next)
    } catch {
      // The choice still applies for this visit if storage is blocked.
    }
  }

  function toggle() {
    setNavLayout(layout === 'side' ? 'top' : 'side')
  }

  return { layout, setNavLayout, toggle }
}

/** One control: hides the icon row, and brings that same row back. */
export function AppsBarToggle({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hidden}
      aria-expanded={!hidden}
      aria-controls="app-icon-bar"
      title={hidden ? 'Show the app icons' : 'Hide the app icons'}
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground hover:bg-muted"
    >
      <LayoutGridIcon className="size-3.5 text-primary" aria-hidden />
      {hidden ? 'Show apps' : 'Hide apps'}
      {hidden ? (
        <ChevronDownIcon className="size-3.5" aria-hidden />
      ) : (
        <ChevronUpIcon className="size-3.5" aria-hidden />
      )}
    </button>
  )
}

/**
 * System apps live in the sidebar (default) or the top row.
 * The open app’s own sections always stay in the header tab strip.
 */
export function AppsNavLayoutToggle({
  layout,
  onToggle,
}: {
  layout: AppsNavLayout
  onToggle: () => void
}) {
  const side = layout === 'side'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={side}
      aria-controls={side ? 'app-side-rail' : 'app-icon-bar'}
      title={
        side
          ? 'Move system apps to the top header'
          : 'Move system apps to the left sidebar (header keeps this app only)'
      }
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground hover:bg-muted"
    >
      <PanelLeftIcon className="size-3.5 text-primary" aria-hidden />
      {side ? 'Apps on top' : 'Apps on side'}
    </button>
  )
}

/**
 * While the icon row is hidden, the app you are in stays one click away
 * so you can return to its front door without opening every icon.
 */
export function ActiveAppLink({
  permissions,
  hiddenApps,
  barHidden,
}: {
  permissions: string[]
  hiddenApps?: string[]
  barHidden: boolean
}) {
  const pathname = usePathname()
  if (!barHidden) return null

  const visible = appsForPermissions(permissions).filter((entry) => !hiddenApps?.includes(entry.key))
  const key = appForPath(
    pathname,
    visible.map((entry) => ({ key: entry.key, href: entry.href, also: APP_ALSO[entry.key] })),
  )
  const app = visible.find((entry) => entry.key === key)
  if (!app) return null

  return (
    <Link
      href={app.href}
      title={`Back to ${app.label}`}
      className="inline-flex h-7 max-w-[10rem] shrink-0 items-center truncate rounded-full bg-card px-2.5 text-xs font-semibold text-foreground shadow-sm ring-1 ring-border hover:bg-muted"
    >
      {app.label}
    </Link>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDownIcon, ChevronUpIcon, LayoutGridIcon } from 'lucide-react'

import { appForPath } from '@/lib/app-memory'
import { APP_ALSO, appsForPermissions } from './launcher-apps'

/** Remembered in this browser so the icon row stays hidden after a reload. */
export const APPS_BAR_STORAGE_KEY = 'bp.apps-bar.hidden'

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

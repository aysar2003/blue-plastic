'use client'

import { Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'

import { normalizeHref, parentOf, popScreen, readTrail, writeTrail } from '@/lib/nav-trail'
import { startNavigationProgress } from './navigation-progress'

/**
 * One Back for the whole system. Returns to the screen that was open before
 * this one (session trail), including query string — not a fixed parent or
 * the dashboard.
 *
 * POS hub pages (Orders, Sessions, …) stay inside Point of Sale: if the trail
 * would jump out to Apps overview, land on the POS dashboard instead.
 */
export function HistoryBack() {
  return (
    <Suspense fallback={null}>
      <HistoryBackInner />
    </Suspense>
  )
}

const POS_HUB =
  /^\/pos(\/(orders|sessions|quotations|settings)(\/|$|\?)|$)/

function stayInPosHub(pathname: string, target: string): string {
  if (!POS_HUB.test(pathname)) return target
  const path = target.split('?')[0] ?? target
  if (path === '/pos' || path.startsWith('/pos/')) return target
  return '/pos'
}

function HistoryBackInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const search = searchParams.toString()
  const href = normalizeHref(search ? `${pathname}?${search}` : pathname)

  if (pathname === '/dashboard') return null

  return (
    <button
      type="button"
      onClick={() => {
        const { target, trail } = popScreen(readTrail(), href)
        const next = stayInPosHub(pathname, target ?? parentOf(pathname))
        writeTrail(trail.length > 0 ? trail : [normalizeHref(next)])
        startNavigationProgress()
        router.push(next)
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
    >
      <ArrowLeftIcon className="size-3.5" aria-hidden />
      Back
    </button>
  )
}

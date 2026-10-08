'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'

import { earlierScreen, parentOf, readTrail, rememberScreen, writeTrail } from '@/lib/nav-trail'
import { startNavigationProgress } from './navigation-progress'

/**
 * One Back for the whole system. It returns to the screen that was open
 * before this one — including query string (so Customers?id=… comes back
 * after QuickReport, instead of a blank default list).
 */
export function HistoryBack() {
  return (
    <Suspense fallback={null}>
      <HistoryBackInner />
    </Suspense>
  )
}

function HistoryBackInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const search = searchParams.toString()
  const href = search ? `${pathname}?${search}` : pathname

  useEffect(() => {
    writeTrail(rememberScreen(readTrail(), href))
  }, [href])

  if (pathname === '/dashboard') return null

  return (
    <button
      type="button"
      onClick={() => {
        const previous = earlierScreen(readTrail(), href)
        const target = previous ?? parentOf(pathname)
        if (!previous) writeTrail([target])
        startNavigationProgress()
        router.push(target)
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
    >
      <ArrowLeftIcon className="size-3.5" aria-hidden />
      Back
    </button>
  )
}

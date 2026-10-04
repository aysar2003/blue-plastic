'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'

import { earlierScreen, parentOf, readTrail, rememberScreen, writeTrail } from '@/lib/nav-trail'
import { startNavigationProgress } from './navigation-progress'

/**
 * One Back for the whole system. It returns to the screen that was open
 * before this one. A visit with nothing behind it steps up to the parent.
 */
export function HistoryBack() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    writeTrail(rememberScreen(readTrail(), pathname))
  }, [pathname])

  if (pathname === '/dashboard' || pathname.endsWith('/print')) return null

  return (
    <button
      type="button"
      onClick={() => {
        const previous = earlierScreen(readTrail(), pathname)
        const href = previous ?? parentOf(pathname)
        if (!previous) writeTrail([href])
        startNavigationProgress()
        router.push(href)
      }}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
    >
      <ArrowLeftIcon className="size-3.5" aria-hidden />
      Back
    </button>
  )
}

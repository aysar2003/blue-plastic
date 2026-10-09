'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { normalizeHref, readTrail, rememberScreen, writeTrail } from '@/lib/nav-trail'

/**
 * Records every screen in this tab — including the live POS till where the
 * Back button is hidden. Without this, leaving the till for a quotation
 * starts a fresh trail and Back climbs to the dashboard.
 */
export function NavTrailRecorder() {
  return (
    <Suspense fallback={null}>
      <NavTrailRecorderInner />
    </Suspense>
  )
}

function NavTrailRecorderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const href = normalizeHref(search ? `${pathname}?${search}` : pathname)

  useEffect(() => {
    if (pathname.endsWith('/print') || pathname.endsWith('/display')) return
    writeTrail(rememberScreen(readTrail(), href))
  }, [href, pathname])

  return null
}

'use client'

import { useEffect } from 'react'

import { useBrowserStore } from '@/lib/browser-store'
import { parseWebsiteLook, WEBSITE_LOOK_KEY } from '@/lib/website-look'

/**
 * Keeps <html data-website-look> in sync with Appearance → Website look,
 * so the public landing and auth pages can switch between brand and system.
 */
export function WebsiteLookProvider() {
  const saved = useBrowserStore(WEBSITE_LOOK_KEY)
  const look = parseWebsiteLook(saved)

  useEffect(() => {
    document.documentElement.setAttribute('data-website-look', look)
  }, [look])

  return null
}

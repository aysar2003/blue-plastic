'use client'

import type { CSSProperties, ReactNode } from 'react'

import { useBrowserStore } from '@/lib/browser-store'
import { parseWebsiteLook, WEBSITE_LOOK_KEY } from '@/lib/website-look'

/**
 * SOM system desk colours on the public site (Appearance → Website look → brand).
 * Matches html.som primary cyan so marketing and the signed-in books share one brand.
 */
const BRAND_VARS = {
  '--background': '#f4f8fb',
  '--foreground': '#0f172a',
  '--card': '#ffffff',
  '--card-foreground': '#0f172a',
  '--popover': '#ffffff',
  '--popover-foreground': '#0f172a',
  '--primary': '#0e7490',
  '--primary-foreground': '#ffffff',
  '--secondary': '#e8eef4',
  '--secondary-foreground': '#0f172a',
  '--muted': '#e8eef4',
  '--muted-foreground': '#334155',
  '--accent': '#cffafe',
  '--accent-foreground': '#0e7490',
  '--destructive': '#dc2626',
  '--destructive-foreground': '#ffffff',
  '--success': '#0e7490',
  '--success-foreground': '#ffffff',
  '--warning': '#b41309',
  '--warning-foreground': '#fffbeb',
  '--border': '#c5d4e0',
  '--input': '#c5d4e0',
  '--ring': '#0e7490',
  '--glow': 'rgba(14, 116, 144, 0.28)',
  '--band': '#dbe7f0',
  '--stripe': '#e8eef4',
} as CSSProperties

/**
 * Applies Appearance → Website look to the marketing site and auth marketing
 * pages (register / setup). Login doors under `/login/*` use their own shells.
 * "system" inherits the active theme; "brand" locks SOM cyan desk colours.
 */
export function WebsiteShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const look = parseWebsiteLook(useBrowserStore(WEBSITE_LOOK_KEY))

  return (
    <div
      className={className}
      data-website-shell={look}
      /* Always SOM cyan desk tokens so the public site matches system colour. */
      style={BRAND_VARS}
    >
      {children}
    </div>
  )
}

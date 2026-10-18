'use client'

import type { CSSProperties, ReactNode } from 'react'

import { useBrowserStore } from '@/lib/browser-store'
import { parseWebsiteLook, WEBSITE_LOOK_KEY } from '@/lib/website-look'

/** Navy / cyan product-site tokens — scoped so they do not change the books desk. */
const BRAND_VARS = {
  '--background': '#070b14',
  '--foreground': '#cbd5e1',
  '--card': '#0b1220',
  '--card-foreground': '#f8fafc',
  '--popover': '#0b1220',
  '--popover-foreground': '#f8fafc',
  '--primary': '#22d3ee',
  '--primary-foreground': '#070b14',
  '--secondary': 'rgb(255 255 255 / 0.06)',
  '--secondary-foreground': '#e2e8f0',
  '--muted': 'rgb(255 255 255 / 0.08)',
  '--muted-foreground': '#94a3b8',
  '--accent': 'rgb(34 211 238 / 0.12)',
  '--accent-foreground': '#67e8f9',
  '--destructive': '#fb7185',
  '--destructive-foreground': '#fff1f2',
  '--success': '#67e8f9',
  '--success-foreground': '#070b14',
  '--warning': '#fbbf24',
  '--warning-foreground': '#422006',
  '--border': 'rgb(255 255 255 / 0.1)',
  '--input': 'rgb(255 255 255 / 0.14)',
  '--ring': '#22d3ee',
  '--glow': 'rgba(34, 211, 238, 0.55)',
} as CSSProperties

/**
 * Applies Appearance → Website look to the marketing site and auth marketing
 * pages (register / setup). Login doors under `/login/*` use their own shells.
 * "system" inherits the active theme; "brand" restores the navy/cyan site.
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
      style={look === 'brand' ? BRAND_VARS : undefined}
    >
      {children}
    </div>
  )
}

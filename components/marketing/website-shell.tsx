'use client'

import type { CSSProperties, ReactNode } from 'react'

import { useBrowserStore } from '@/lib/browser-store'
import { parseWebsiteLook, WEBSITE_LOOK_KEY } from '@/lib/website-look'

/**
 * Advanced product website — SOM navy + cyan (not white paper).
 * Matches the classic product night brand used on login marketing.
 */
const BRAND_VARS = {
  '--background': '#05080f',
  '--foreground': '#e2e8f0',
  '--card': '#0b1220',
  '--card-foreground': '#f8fafc',
  '--popover': '#0b1220',
  '--popover-foreground': '#f8fafc',
  '--primary': '#22d3ee',
  '--primary-foreground': '#05080f',
  '--secondary': '#121a2a',
  '--secondary-foreground': '#e2e8f0',
  '--muted': '#151d2e',
  '--muted-foreground': '#94a3b8',
  '--accent': 'rgb(34 211 238 / 0.12)',
  '--accent-foreground': '#67e8f9',
  '--destructive': '#fb7185',
  '--destructive-foreground': '#fff1f2',
  '--success': '#22d3ee',
  '--success-foreground': '#05080f',
  '--warning': '#fbbf24',
  '--warning-foreground': '#422006',
  '--border': 'rgb(148 163 184 / 0.18)',
  '--input': 'rgb(148 163 184 / 0.22)',
  '--ring': '#22d3ee',
  '--glow': 'rgba(34, 211, 238, 0.45)',
  '--band': '#0d1524',
  '--stripe': '#0a101c',
} as CSSProperties

/**
 * Marketing / register shell. Always uses the advanced navy+cyan product skin.
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
    <div className={className} data-website-shell={look} style={BRAND_VARS}>
      {children}
    </div>
  )
}

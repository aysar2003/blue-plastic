'use client'

import type { CSSProperties, ReactNode } from 'react'

import { useBrowserStore } from '@/lib/browser-store'
import { parseWebsiteLook, WEBSITE_LOOK_KEY } from '@/lib/website-look'

/**
 * Marketing website — dark ink + champagne luxury (not neon cyan tech).
 * Login doors keep their own cyan / indigo skins outside this shell.
 */
const BRAND_VARS = {
  '--background': '#07060a',
  '--foreground': '#f3eee6',
  '--card': '#100e14',
  '--card-foreground': '#f7f2ea',
  '--popover': '#100e14',
  '--popover-foreground': '#f7f2ea',
  '--primary': '#c4a574',
  '--primary-foreground': '#0a090c',
  '--secondary': '#16131c',
  '--secondary-foreground': '#ebe4d8',
  '--muted': '#15131a',
  '--muted-foreground': '#a89f92',
  '--accent': 'rgb(196 165 116 / 0.12)',
  '--accent-foreground': '#e4d0a8',
  '--destructive': '#fb7185',
  '--destructive-foreground': '#fff1f2',
  '--success': '#c4a574',
  '--success-foreground': '#0a090c',
  '--warning': '#d4b483',
  '--warning-foreground': '#2a2114',
  '--border': 'rgb(196 165 116 / 0.16)',
  '--input': 'rgb(196 165 116 / 0.2)',
  '--ring': '#c4a574',
  '--glow': 'rgba(196, 165, 116, 0.35)',
  '--band': '#0e0c12',
  '--stripe': '#0a090e',
} as CSSProperties

/**
 * Marketing / register shell. Always uses the ink + champagne luxury skin.
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

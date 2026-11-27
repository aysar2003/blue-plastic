'use client'

import { useTheme } from 'next-themes'

/** Champagne CSS vars for login shells (same ink+gold as WebsiteShell). */
export const LOGIN_LUXURY_STYLE = {
  '--background': '#07060a',
  '--foreground': '#f3eee6',
  '--card': '#100e14',
  '--card-foreground': '#f7f2ea',
  '--primary': '#c4a574',
  '--primary-foreground': '#0a090c',
  '--muted': '#15131a',
  '--muted-foreground': '#c4b8a8',
  '--border': 'rgb(196 165 116 / 0.18)',
  '--ring': '#c4a574',
  '--accent': 'rgb(196 165 116 / 0.14)',
  '--accent-foreground': '#e4d0a8',
} as const

/** True when books System look is Luxury — login doors should match VIP champagne. */
export function useLoginLuxury(): boolean {
  const { theme, resolvedTheme } = useTheme()
  const active = theme === 'system' ? resolvedTheme : theme
  return active === 'luxury'
}

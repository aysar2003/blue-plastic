import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

export function memberInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

/** Soft hue from the name so each person reads as distinct without photos. */
export function memberAccent(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const hues = [190, 168, 205, 145, 220, 175, 155]
  return hues[hash % hues.length]!
}

export function memberAvatarStyle(name: string): CSSProperties {
  const hue = memberAccent(name)
  return {
    background: `linear-gradient(145deg, hsl(${hue} 55% 42%), hsl(${hue + 18} 50% 28%))`,
  }
}

export function memberAvatarClass(size: 'sm' | 'md' | 'lg' = 'md') {
  return cn(
    'shrink-0 font-semibold tracking-wide text-white ring-2 ring-[color-mix(in_oklab,var(--background)_70%,transparent)]',
    size === 'sm' && 'size-9 text-[0.7rem]',
    size === 'md' && 'size-11 text-sm',
    size === 'lg' && 'size-[4.25rem] text-lg',
  )
}

export function statusDotClass(variant: 'success' | 'destructive' | 'warning') {
  if (variant === 'success') return 'bg-emerald-400 shadow-[0_0_0_3px_rgb(52_211_153/0.18)]'
  if (variant === 'destructive') return 'bg-rose-400 shadow-[0_0_0_3px_rgb(251_113_133/0.18)]'
  return 'bg-amber-400 shadow-[0_0_0_3px_rgb(251_191_36/0.18)]'
}

'use client'

import { useEffect, useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { useTheme } from 'next-themes'

import { THEMES, type ThemeId } from '@/lib/themes'
import { cn } from '@/lib/utils'

export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const current = (mounted ? theme : 'ocean') as ThemeId

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {THEMES.map((option) => {
        const active = current === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(option.id)}
            className={cn(
              'rounded-xl border bg-card p-3 text-left transition-colors',
              active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/40',
            )}
          >
            <span className="flex gap-1.5" aria-hidden>
              {option.swatches.map((color) => (
                <span key={color} className="h-8 flex-1 rounded-md" style={{ background: color }} />
              ))}
            </span>
            <span className="mt-3 flex items-center justify-between gap-2">
              <span className="font-medium">{option.label}</span>
              {active ? <CheckIcon className="size-4 text-primary" /> : null}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{option.blurb}</span>
          </button>
        )
      })}
    </div>
  )
}

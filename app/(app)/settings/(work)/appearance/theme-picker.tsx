'use client'

import { useSyncExternalStore } from 'react'
import { CheckIcon } from 'lucide-react'
import { useTheme } from 'next-themes'

import { writeBrowserStore } from '@/lib/browser-store'
import { REPORT_STYLE_KEY, type ReportStyleId } from '@/lib/report-styles'
import { THEME_GROUPS, THEMES, type ThemeId } from '@/lib/themes'
import { cn } from '@/lib/utils'

/** Full brand skins also set the matching report paper. */
function reportStyleForTheme(id: ThemeId): ReportStyleId | null {
  if (id === 'quick' || id === 'quick-dark') return 'quickbooks'
  if (id === 'odoo' || id === 'odoo-dark') return 'odoo'
  return null
}

export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const current = (mounted ? (theme ?? 'som') : 'som') as ThemeId

  const pick = (id: ThemeId) => {
    setTheme(id)
    const reportStyle = reportStyleForTheme(id)
    if (reportStyle) writeBrowserStore(REPORT_STYLE_KEY, reportStyle)
  }

  return (
    <div className="space-y-8">
      {THEME_GROUPS.map((group) => {
        const options = THEMES.filter((themeOption) => themeOption.group === group.id)
        if (options.length === 0) return null
        return (
          <section key={group.id} className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{group.hint}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {options.map((option) => {
                const active = current === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => pick(option.id)}
                    className={cn(
                      'rounded-xl border bg-card p-3 text-left transition-colors',
                      active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/40',
                    )}
                  >
                    <span className="flex gap-1.5" aria-hidden>
                      {option.swatches.map((color) => (
                        <span
                          key={color}
                          className="h-8 flex-1 rounded-md border border-black/5"
                          style={{ background: color }}
                        />
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
          </section>
        )
      })}
    </div>
  )
}

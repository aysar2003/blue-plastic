'use client'

import { useSyncExternalStore } from 'react'
import { CheckIcon, SparklesIcon } from 'lucide-react'
import { useTheme } from 'next-themes'

import { writeBrowserStore } from '@/lib/browser-store'
import { REPORT_STYLE_KEY, reportStyleForTheme } from '@/lib/report-styles'
import { THEME_GROUPS, THEMES, type ThemeId } from '@/lib/themes'
import { cn } from '@/lib/utils'

/**
 * Full brand skins also set the matching report paper.
 * SOM / colour shells reset to herobooks so a prior Odoo Style pick cannot leave
 * the plum masthead after the desk theme already matches the website.
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const current = (
    mounted
      ? theme === 'quick' || theme === 'quick-dark'
        ? 'som'
        : (theme ?? 'som')
      : 'som'
  ) as ThemeId

  const pick = (id: ThemeId) => {
    setTheme(id)
    writeBrowserStore(REPORT_STYLE_KEY, reportStyleForTheme(id))
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
                const vip = Boolean(option.vip)
                const isAi = option.id === 'ai'
                const isLuxury = option.id === 'luxury'
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => pick(option.id)}
                    className={cn(
                      'relative overflow-hidden rounded-2xl border p-3 text-left transition-all duration-300',
                      isAi
                        ? cn(
                            'border-[#60a5fa]/45 bg-[linear-gradient(155deg,#060910_0%,#0b1220_45%,#0a1628_100%)] shadow-[0_0_0_1px_rgba(59,130,246,0.16),0_16px_36px_-18px_rgba(59,130,246,0.55)]',
                            active
                              ? 'ring-2 ring-[#38bdf8]/50 shadow-[0_0_0_1px_rgba(56,189,248,0.35),0_0_40px_-10px_rgba(59,130,246,0.7)]'
                              : 'hover:border-[#7dd3fc]/70 hover:shadow-[0_0_0_1px_rgba(125,211,252,0.28),0_20px_40px_-16px_rgba(59,130,246,0.65)]',
                          )
                        : isLuxury
                          ? cn(
                              'border-[#c4a574]/55 bg-[linear-gradient(145deg,#0c0b10_0%,#141018_55%,#1a1510_100%)] shadow-[0_0_0_1px_rgba(196,165,116,0.12),0_12px_28px_-16px_rgba(196,165,116,0.45)]',
                              active
                                ? 'ring-2 ring-[#c4a574]/45'
                                : 'hover:border-[#c4a574]/80 hover:shadow-[0_0_0_1px_rgba(196,165,116,0.22),0_16px_32px_-14px_rgba(196,165,116,0.55)]',
                            )
                          : cn(
                              'bg-card',
                              active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/40',
                            ),
                    )}
                  >
                    {isAi ? (
                      <>
                        <span
                          aria-hidden
                          className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.35)_0%,transparent_70%)] blur-2xl"
                        />
                        <span
                          aria-hidden
                          className="pointer-events-none absolute -bottom-10 -left-6 size-28 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.3)_0%,transparent_70%)] blur-2xl"
                        />
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7dd3fc]/90 to-transparent"
                        />
                      </>
                    ) : null}
                    {isLuxury ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c4a574]/80 to-transparent"
                      />
                    ) : null}
                    <span className="relative flex gap-1.5" aria-hidden>
                      {option.swatches.map((color, index) => (
                        <span
                          key={color}
                          className={cn(
                            'h-9 flex-1 rounded-lg border border-black/5 transition-transform duration-300',
                            vip && 'border-white/10',
                            isAi && 'border-[#60a5fa]/25 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.08)]',
                            isLuxury && 'border-[#c4a574]/25 shadow-[inset_0_0_0_1px_rgba(243,238,230,0.06)]',
                            active && index === 1 && 'scale-[1.04]',
                          )}
                          style={{
                            background: isAi && index === 1
                              ? 'linear-gradient(145deg, #60a5fa, #3b82f6 50%, #22d3ee)'
                              : color,
                          }}
                        />
                      ))}
                    </span>
                    <span className="relative mt-3 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            'font-medium',
                            isAi && 'text-[#e8eef8]',
                            isLuxury && 'text-[#f3eee6]',
                          )}
                        >
                          {option.label}
                        </span>
                        {isAi ? (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-[#3b82f6]/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-[#7dd3fc] ring-1 ring-inset ring-[#60a5fa]/45">
                            <SparklesIcon className="size-2.5" />
                            NEURAL
                          </span>
                        ) : null}
                        {isLuxury ? (
                          <span className="rounded-sm bg-[#c4a574]/18 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-[#c4a574] ring-1 ring-inset ring-[#c4a574]/35">
                            VIP
                          </span>
                        ) : null}
                      </span>
                      {active ? (
                        <CheckIcon
                          className={cn(
                            'size-4',
                            isAi ? 'text-[#7dd3fc]' : isLuxury ? 'text-[#c4a574]' : 'text-primary',
                          )}
                        />
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        'relative mt-0.5 block text-xs',
                        isAi ? 'text-[#9eb6d4]' : isLuxury ? 'text-[#c4b8a8]' : 'text-muted-foreground',
                      )}
                    >
                      {option.blurb}
                    </span>
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

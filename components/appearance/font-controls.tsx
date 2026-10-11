'use client'

import { CheckIcon } from 'lucide-react'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import {
  FONT_SIZE_KEY,
  FONT_SIZES,
  FONT_STYLE_KEY,
  FONT_STYLES,
  parseFontSize,
  parseFontStyle,
  type FontSizeId,
  type FontStyleId,
} from '@/lib/ui-fonts'
import { cn } from '@/lib/utils'

/** Compact selects for toolbars (reports, chart of accounts). */
export function FontToolbarControls({ className }: { className?: string }) {
  const size = parseFontSize(useBrowserStore(FONT_SIZE_KEY))
  const style = parseFontStyle(useBrowserStore(FONT_STYLE_KEY))

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} role="group" aria-label="Font">
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="sr-only sm:not-sr-only">Size</span>
        <select
          value={size}
          aria-label="Font size"
          onChange={(event) => writeBrowserStore(FONT_SIZE_KEY, event.target.value)}
          className="h-8 max-w-[7.5rem] rounded-md border bg-card px-1.5 text-sm text-foreground"
        >
          {FONT_SIZES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="sr-only sm:not-sr-only">Font</span>
        <select
          value={style}
          aria-label="Font style"
          onChange={(event) => writeBrowserStore(FONT_STYLE_KEY, event.target.value)}
          className="h-8 max-w-[9.5rem] rounded-md border bg-card px-1.5 text-sm text-foreground"
        >
          {FONT_STYLES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/** Full picker cards for Settings → Appearance. */
export function FontAppearancePicker() {
  const size = parseFontSize(useBrowserStore(FONT_SIZE_KEY))
  const style = parseFontStyle(useBrowserStore(FONT_STYLE_KEY))

  const pickSize = (id: FontSizeId) => writeBrowserStore(FONT_SIZE_KEY, id)
  const pickStyle = (id: FontStyleId) => writeBrowserStore(FONT_STYLE_KEY, id)

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Font size</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Scales every screen in this browser — lists, forms, reports, and the till shell.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {FONT_SIZES.map((option) => {
            const active = size === option.id
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => pickSize(option.id)}
                className={cn(
                  'rounded-xl border bg-card p-3 text-left transition-colors',
                  active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/40',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    className="font-medium"
                    style={{
                      fontSize:
                        option.id === 'sm'
                          ? '0.8rem'
                          : option.id === 'md'
                            ? '0.95rem'
                            : option.id === 'lg'
                              ? '1.1rem'
                              : '1.25rem',
                    }}
                  >
                    {option.label}
                  </span>
                  {active ? <CheckIcon className="size-4 text-primary" /> : null}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{option.blurb}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Font style</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Typeface for the whole system. Theme default keeps QuickBooks / Odoo / Hero ERP fonts.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FONT_STYLES.map((option) => {
            const active = style === option.id
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => pickStyle(option.id)}
                className={cn(
                  'rounded-xl border bg-card p-3 text-left transition-colors',
                  active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/40',
                )}
                style={{
                  fontFamily:
                    option.id === 'geist'
                      ? 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif'
                      : option.id === 'inter'
                        ? 'var(--font-odoo), system-ui, sans-serif'
                        : option.id === 'source-sans'
                          ? 'var(--font-quickbooks), Arial, Helvetica, sans-serif'
                          : option.id === 'system'
                            ? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
                            : undefined,
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{option.label}</span>
                  {active ? <CheckIcon className="size-4 text-primary" /> : null}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{option.blurb}</span>
                <span className="mt-2 block text-sm tracking-tight">Aa Bb Cc 123</span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

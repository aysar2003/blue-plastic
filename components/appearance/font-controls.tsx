'use client'

import { CheckIcon } from 'lucide-react'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import {
  DEFAULT_FONT_SIZE_PX,
  DEFAULT_FONT_STYLE_CUSTOM,
  FONT_CUSTOM_PRESETS,
  FONT_SIZE_KEY,
  FONT_SIZE_PX_KEY,
  FONT_SIZES,
  FONT_STYLE_CUSTOM_KEY,
  FONT_STYLE_KEY,
  FONT_STYLES,
  MAX_FONT_SIZE_PX,
  MIN_FONT_SIZE_PX,
  parseFontSize,
  parseFontSizePx,
  parseFontStyle,
  parseFontStyleCustom,
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

function SizeLadder({
  size,
  sizePx,
  onPick,
  onPx,
}: {
  size: FontSizeId
  sizePx: number
  onPick: (id: FontSizeId) => void
  onPx: (px: number) => void
}) {
  const presets = FONT_SIZES.filter((option) => option.id !== 'custom')

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-1 rounded-2xl border border-border/70 bg-gradient-to-b from-muted/40 to-muted/15 p-1.5"
        role="listbox"
        aria-label="Font size presets"
      >
        {presets.map((option) => {
          const active = size === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onPick(option.id)}
              className={cn(
                'min-w-[4.5rem] flex-1 rounded-xl px-3 py-2.5 text-left transition-all duration-200',
                active
                  ? 'bg-card text-foreground ring-2 ring-primary/45 shadow-sm'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'block font-medium leading-none tracking-tight',
                  active && 'text-primary',
                )}
                style={{ fontSize: option.previewRem ?? '0.95rem' }}
              >
                Aa
              </span>
              <span className="mt-1.5 block text-[11px] font-medium">{option.label}</span>
            </button>
          )
        })}
        <button
          type="button"
          role="option"
          aria-selected={size === 'custom'}
          onClick={() => onPick('custom')}
          className={cn(
            'min-w-[5rem] flex-1 rounded-xl px-3 py-2.5 text-left transition-all duration-200',
            size === 'custom'
              ? 'bg-card text-foreground ring-2 ring-primary/45 shadow-sm'
              : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
          )}
        >
          <span className={cn('block text-sm font-semibold leading-none', size === 'custom' && 'text-primary')}>
            Custom
          </span>
          <span className="mt-1.5 block text-[11px] font-medium">{sizePx}px</span>
        </button>
      </div>

      {size === 'custom' ? (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="font-size-px" className="text-xs font-medium text-muted-foreground">
                Your size
              </label>
              <span className="rounded-md bg-muted/60 px-2 py-0.5 font-mono text-xs tabular-nums text-foreground">
                {sizePx}px
              </span>
            </div>
            <input
              id="font-size-px"
              type="range"
              min={MIN_FONT_SIZE_PX}
              max={MAX_FONT_SIZE_PX}
              step={1}
              value={sizePx}
              aria-label="Custom font size in pixels"
              className="w-full accent-[var(--primary)]"
              onChange={(event) => {
                const next = Number(event.target.value)
                onPx(next)
                onPick('custom')
              }}
            />
            <div className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>{MIN_FONT_SIZE_PX}px</span>
              <span>{MAX_FONT_SIZE_PX}px</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StyleList({
  style,
  customStack,
  onPick,
  onCustom,
}: {
  style: FontStyleId
  customStack: string
  onPick: (id: FontStyleId) => void
  onCustom: (stack: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card/30">
        {FONT_STYLES.map((option) => {
          const active = style === option.id
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(option.id)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                active ? 'bg-primary/10' : 'hover:bg-muted/35',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/80 bg-background',
                )}
              >
                {active ? <CheckIcon className="size-3" strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{option.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{option.blurb}</span>
              </span>
              <span
                className="hidden shrink-0 text-lg tracking-tight text-foreground/80 sm:block"
                style={{
                  fontFamily:
                    option.id === 'custom'
                      ? customStack
                      : (option.previewFamily ?? undefined),
                  fontSize: option.id === 'fraunces' || option.id === 'georgia' ? '1.15rem' : undefined,
                }}
              >
                Aa Bb 123
              </span>
            </button>
          )
        })}
      </div>

      {style === 'custom' ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card/40 p-4">
          <label htmlFor="font-style-custom" className="block text-xs font-medium text-muted-foreground">
            CSS font-family stack
          </label>
          <textarea
            id="font-style-custom"
            rows={2}
            value={customStack}
            spellCheck={false}
            placeholder={DEFAULT_FONT_STYLE_CUSTOM}
            className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/40"
            onChange={(event) => {
              onCustom(event.target.value)
              onPick('custom')
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            {FONT_CUSTOM_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onCustom(preset.stack)
                  onPick('custom')
                }}
                className="rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                style={{ fontFamily: preset.stack }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Full picker for Settings → Appearance — ladder + list, not locked card grids. */
export function FontAppearancePicker() {
  const size = parseFontSize(useBrowserStore(FONT_SIZE_KEY))
  const style = parseFontStyle(useBrowserStore(FONT_STYLE_KEY))
  const sizePx = parseFontSizePx(useBrowserStore(FONT_SIZE_PX_KEY))
  const customStack = parseFontStyleCustom(useBrowserStore(FONT_STYLE_CUSTOM_KEY))

  const pickSize = (id: FontSizeId) => {
    writeBrowserStore(FONT_SIZE_KEY, id)
    if (id === 'custom' && !Number.isFinite(sizePx)) {
      writeBrowserStore(FONT_SIZE_PX_KEY, String(DEFAULT_FONT_SIZE_PX))
    }
  }
  const pickStyle = (id: FontStyleId) => writeBrowserStore(FONT_STYLE_KEY, id)
  const setPx = (px: number) => writeBrowserStore(FONT_SIZE_PX_KEY, String(px))
  const setCustom = (stack: string) => writeBrowserStore(FONT_STYLE_CUSTOM_KEY, stack)

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Font size</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Six presets plus a custom pixel slider — scales every screen in this browser.
          </p>
        </div>
        <SizeLadder size={size} sizePx={sizePx} onPick={pickSize} onPx={setPx} />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Font style</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Nine typefaces plus your own CSS stack. Theme default keeps Odoo / SOM ERP fonts.
          </p>
        </div>
        <StyleList style={style} customStack={customStack} onPick={pickStyle} onCustom={setCustom} />
      </section>
    </div>
  )
}

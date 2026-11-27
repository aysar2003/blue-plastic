'use client'

import { CheckIcon } from 'lucide-react'

import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import {
  parseReportStyle,
  parseReportStyleCustom,
  REPORT_STYLE_CUSTOM_KEY,
  REPORT_STYLE_KEY,
  REPORT_STYLES,
  type ReportStyleCustom,
  type ReportStyleId,
} from '@/lib/report-styles'
import { cn } from '@/lib/utils'

type PreviewLayout =
  | 'band'
  | 'flat-rule'
  | 'filled-total'
  | 'solid-head'
  | 'navy-head'
  | 'grid'
  | 'ibcs'
  | 'fluent'
  | 'dense-bar'
  | 'cream'
  | 'ink'

function previewLayoutFor(id: ReportStyleId): PreviewLayout {
  switch (id) {
    case 'xero':
      return 'flat-rule'
    case 'sage':
      return 'filled-total'
    case 'wave':
      return 'cream'
    case 'freshbooks':
      return 'navy-head'
    case 'zoho':
      return 'grid'
    case 'sap':
      return 'ibcs'
    case 'dynamics':
      return 'fluent'
    case 'netsuite':
      return 'dense-bar'
    case 'odoo':
      return 'solid-head'
    case 'ai':
    case 'ink':
      return 'ink'
    default:
      return 'band'
  }
}

function PaperPreview({
  sheet,
  band,
  accent,
  fontFamily,
  layout = 'band',
}: {
  sheet: string
  band: string
  accent: string
  fontFamily?: string
  layout?: PreviewLayout
}) {
  const rowFg = layout === 'ink' ? '#ededed' : '#1f2937'
  const muted = layout === 'ink' ? '#a3a3a3' : '#4b5563'

  const headBg =
    layout === 'flat-rule' || layout === 'filled-total'
      ? sheet
      : layout === 'cream'
        ? accent
        : layout === 'navy-head'
          ? '#001b40'
          : layout === 'grid'
            ? accent
            : layout === 'ibcs'
              ? '#233549'
              : layout === 'fluent'
                ? '#f3f2f1'
                : layout === 'dense-bar'
                  ? accent
                  : layout === 'solid-head'
                    ? '#3f2a3d'
                    : layout === 'ink'
                      ? band
                      : band

  const resolvedHeadColor =
    layout === 'flat-rule'
      ? '#000856'
      : layout === 'filled-total' || layout === 'fluent'
        ? '#111111'
        : layout === 'band'
          ? '#1f2937'
          : '#ffffff'

  const totalBg =
    layout === 'filled-total'
      ? accent
      : layout === 'dense-bar'
        ? '#403c38'
        : layout === 'cream'
          ? '#fff3e8'
          : layout === 'ibcs'
            ? '#edf0f3'
            : layout === 'fluent'
              ? '#e5f7f8'
              : layout === 'flat-rule' || layout === 'grid'
                ? sheet
                : layout === 'ink'
                  ? band
                  : band

  const totalFg =
    layout === 'filled-total'
      ? '#003d21'
      : layout === 'dense-bar'
        ? '#ffffff'
        : layout === 'cream'
          ? '#7a3200'
          : layout === 'ibcs'
            ? '#233549'
            : layout === 'ink'
              ? '#ededed'
              : rowFg

  const frameRadius =
    layout === 'cream'
      ? '1rem'
      : layout === 'fluent'
        ? '0.125rem'
        : layout === 'navy-head' ||
            layout === 'dense-bar' ||
            layout === 'ibcs' ||
            layout === 'grid' ||
            layout === 'filled-total'
          ? '0'
          : '0.5rem'

  return (
    <span
      className="block overflow-hidden border border-black/5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]"
      style={{
        color: rowFg,
        fontFamily,
        borderRadius: frameRadius,
        borderTop:
          layout === 'filled-total' || layout === 'fluent' ? `3px solid ${accent}` : undefined,
        borderLeft: layout === 'fluent' ? `3px solid ${accent}` : undefined,
      }}
      aria-hidden
    >
      <span
        className={cn(
          'flex h-6 items-center px-2 text-[0.6rem] font-semibold tracking-wide',
          (layout === 'navy-head' || layout === 'dense-bar' || layout === 'ibcs') && 'uppercase',
        )}
        style={{
          background: headBg,
          color: resolvedHeadColor,
          borderBottom:
            layout === 'flat-rule'
              ? `2px solid ${accent}`
              : layout === 'ibcs'
                ? '3px double #9daebe'
                : layout === 'fluent'
                  ? `2px solid ${accent}`
                  : layout === 'grid'
                    ? '1px solid #cfd8e3'
                    : undefined,
        }}
      >
        Account
        <span className="ml-auto tabular">Amount</span>
      </span>
      <span
        className="flex h-5 items-center px-2 text-[0.6rem]"
        style={{
          background: sheet,
          border: layout === 'grid' ? '1px solid #cfd8e3' : undefined,
          borderTop: layout === 'grid' ? 'none' : undefined,
        }}
      >
        {layout === 'band' || layout === 'navy-head' || layout === 'cream' ? (
          <span className="mr-1.5 size-1.5 shrink-0 rounded-full" style={{ background: accent }} />
        ) : null}
        Cash
        <span className="ml-auto tabular" style={{ color: muted }}>
          1,200.00
        </span>
      </span>
      <span
        className="flex h-5 items-center px-2 text-[0.6rem] font-semibold"
        style={{
          background: totalBg,
          color: totalFg,
          borderLeft:
            layout === 'cream' || layout === 'navy-head' || layout === 'fluent' || layout === 'band'
              ? `3px solid ${layout === 'cream' ? '#fd6f00' : accent}`
              : undefined,
          borderBottom: layout === 'flat-rule' ? '3px solid #50dcaa' : undefined,
          borderTop:
            layout === 'grid'
              ? '3px solid #e42527'
              : layout === 'ibcs'
                ? '2px solid #233549'
                : undefined,
          border: layout === 'grid' ? '1px solid #cfd8e3' : undefined,
        }}
      >
        Bank
        <span className="ml-auto tabular">4,500.00</span>
      </span>
    </span>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
}) {
  return (
    <label className="block space-y-1.5 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          aria-label={label}
          className="h-9 w-12 cursor-pointer rounded-lg border border-input bg-card p-1"
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          value={value}
          spellCheck={false}
          className="h-9 flex-1 rounded-lg border border-input bg-background px-2.5 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          onChange={(event) => {
            const next = event.target.value.trim()
            if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next)
          }}
        />
      </span>
    </label>
  )
}

export function ReportStylePicker() {
  const saved = useBrowserStore(REPORT_STYLE_KEY)
  const customRaw = useBrowserStore(REPORT_STYLE_CUSTOM_KEY)
  const current = parseReportStyle(saved)
  const custom = parseReportStyleCustom(customRaw)

  const pick = (id: ReportStyleId) => writeBrowserStore(REPORT_STYLE_KEY, id)

  const setCustom = (patch: Partial<ReportStyleCustom>) => {
    const next = { ...custom, ...patch }
    writeBrowserStore(REPORT_STYLE_CUSTOM_KEY, JSON.stringify(next))
    pick('custom')
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_STYLES.map((option) => {
          const active = current === option.id
          const [sheet, band, accent] =
            option.id === 'custom' ? [custom.sheet, custom.band, custom.accent] : option.swatches
          const fontFamily =
            option.id === 'quickbooks'
              ? 'var(--font-quickbooks), Arial, sans-serif'
              : option.id === 'odoo'
                ? 'var(--font-odoo), Inter, sans-serif'
                : option.id === 'luxury'
                  ? 'var(--font-marketing-display), Georgia, serif'
                  : option.id === 'dynamics'
                    ? "'Segoe UI', system-ui, sans-serif"
                    : undefined

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => pick(option.id)}
              className={cn(
                'group rounded-2xl border p-3 text-left transition-all duration-200',
                active
                  ? 'border-primary/70 bg-primary/10 ring-2 ring-primary/40'
                  : 'border-border/70 bg-card/40 hover:border-primary/35 hover:bg-card/70',
              )}
            >
              <PaperPreview
                sheet={sheet}
                band={band}
                accent={accent}
                fontFamily={fontFamily}
                layout={previewLayoutFor(option.id)}
              />
              <span className="mt-2.5 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                <span
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full border transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/70 text-transparent group-hover:border-primary/40',
                  )}
                >
                  <CheckIcon className="size-3" strokeWidth={3} />
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{option.blurb}</span>
              <span className="mt-2 flex gap-1" aria-hidden>
                {[sheet, band, accent].map((color) => (
                  <span
                    key={`${option.id}-${color}`}
                    className="h-1.5 flex-1 rounded-full"
                    style={{ background: color }}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      {current === 'custom' ? (
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Your paper colours</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sheet background, row band, and accent mark — saved in this browser.
              </p>
            </div>
            <div className="w-36 shrink-0">
              <PaperPreview sheet={custom.sheet} band={custom.band} accent={custom.accent} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ColorField label="Sheet" value={custom.sheet} onChange={(sheet) => setCustom({ sheet })} />
            <ColorField label="Band" value={custom.band} onChange={(band) => setCustom({ band })} />
            <ColorField label="Accent" value={custom.accent} onChange={(accent) => setCustom({ accent })} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

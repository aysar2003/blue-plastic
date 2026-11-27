'use client'

import { CheckIcon } from 'lucide-react'

import { TemplateLayoutPreview } from '@/components/templates/template-layout-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  applyTemplateLookPreset,
  DEFAULT_TEMPLATE_LOOK,
  TEMPLATE_LOOK_FONTS,
  TEMPLATE_LOOK_PRESETS,
  type TemplateLook,
  type TemplateLookDensity,
  type TemplateLookHeaderStyle,
  type TemplateLookPresetId,
} from '@/lib/template-look'
import { cn } from '@/lib/utils'

export function TemplateLookEditor({
  layoutId,
  layoutLabel,
  look,
  onChange,
  onReset,
}: {
  layoutId: string
  layoutLabel: string
  look: TemplateLook
  onChange: (next: TemplateLook) => void
  onReset?: () => void
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="space-y-4">
        <section className="space-y-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Style types</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Dooro nooc — then fine-tune fonts, colour, and frame on the right.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {TEMPLATE_LOOK_PRESETS.map((preset) => {
              const selected = look.presetId === preset.id
              const previewLook = applyTemplateLookPreset(preset.id, {
                ...look,
                title: look.title || layoutLabel,
              })
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange(applyTemplateLookPreset(preset.id as TemplateLookPresetId, look))}
                  className={cn(
                    'rounded-xl border p-2 text-left transition-colors',
                    selected
                      ? 'border-primary bg-accent/40 ring-2 ring-primary/25'
                      : 'border-border bg-background hover:border-primary/40 hover:bg-secondary/40',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{preset.label}</span>
                    {selected ? <CheckIcon className="size-3.5 shrink-0 text-primary" aria-hidden /> : null}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{preset.blurb}</span>
                  <div className="mt-2 overflow-hidden" style={{ height: 56 }}>
                    <TemplateLayoutPreview
                      kind={layoutId}
                      look={{ ...previewLook, fontSize: 11 }}
                      className="h-14 max-w-none shadow-none"
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <TemplateLayoutPreview
          kind={layoutId}
          look={look}
          size="stage"
          className="max-w-none"
        />
      </div>

      <aside className="space-y-3 rounded-lg border border-border bg-background p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edit style</p>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Title</span>
          <Input
            value={look.title}
            placeholder={layoutLabel}
            className="h-8"
            onChange={(event) => onChange({ ...look, title: event.target.value, presetId: 'custom' })}
          />
        </label>

        <fieldset className="space-y-1.5">
          <legend className="text-[11px] font-medium text-muted-foreground">Header</legend>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                ['line', 'Line'],
                ['band', 'Band'],
                ['plain', 'Plain'],
              ] as const satisfies ReadonlyArray<readonly [TemplateLookHeaderStyle, string]>
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={look.headerStyle === id ? 'default' : 'outline'}
                onClick={() => onChange({ ...look, headerStyle: id, presetId: 'custom' })}
              >
                {label}
              </Button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-[11px] font-medium text-muted-foreground">Density</legend>
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                ['comfortable', 'Roomy'],
                ['compact', 'Compact'],
              ] as const satisfies ReadonlyArray<readonly [TemplateLookDensity, string]>
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={look.density === id ? 'default' : 'outline'}
                onClick={() => onChange({ ...look, density: id, presetId: 'custom' })}
              >
                {label}
              </Button>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Font type</span>
          <select
            value={look.fontFamily}
            className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
            onChange={(event) =>
              onChange({ ...look, fontFamily: event.target.value, presetId: 'custom' })
            }
          >
            {TEMPLATE_LOOK_FONTS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Size {look.fontSize}px</span>
          <input
            type="range"
            min={10}
            max={22}
            value={look.fontSize}
            className="w-full"
            onChange={(event) =>
              onChange({ ...look, fontSize: Number(event.target.value), presetId: 'custom' })
            }
          />
        </label>

        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant={look.fontWeight === 'bold' ? 'default' : 'outline'}
            onClick={() =>
              onChange({
                ...look,
                fontWeight: look.fontWeight === 'bold' ? 'normal' : 'bold',
                presetId: 'custom',
              })
            }
          >
            Bold
          </Button>
        </div>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Accent / style colour</span>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={look.accent}
              className="h-8 w-14 p-1"
              onChange={(event) =>
                onChange({ ...look, accent: event.target.value, presetId: 'custom' })
              }
            />
            <Input
              value={look.accent}
              className="h-8 font-mono text-xs"
              onChange={(event) => {
                const value = event.target.value.trim()
                if (/^#[0-9a-fA-F]{6}$/.test(value)) {
                  onChange({ ...look, accent: value, presetId: 'custom' })
                }
              }}
            />
          </div>
        </label>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Border colour</span>
          <Input
            type="color"
            value={look.borderColor}
            className="h-8 w-full p-1"
            onChange={(event) =>
              onChange({ ...look, borderColor: event.target.value, presetId: 'custom' })
            }
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Border {look.borderWidth}px</span>
          <input
            type="range"
            min={0}
            max={8}
            value={look.borderWidth}
            className="w-full"
            onChange={(event) =>
              onChange({ ...look, borderWidth: Number(event.target.value), presetId: 'custom' })
            }
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Corners {look.radius}px</span>
          <input
            type="range"
            min={0}
            max={24}
            value={look.radius}
            className="w-full"
            onChange={(event) =>
              onChange({ ...look, radius: Number(event.target.value), presetId: 'custom' })
            }
          />
        </label>

        <div className="space-y-2 border-t border-border pt-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={look.showLogo}
              className="size-4 rounded border-input"
              onChange={(event) =>
                onChange({ ...look, showLogo: event.target.checked, presetId: 'custom' })
              }
            />
            Show logo frame
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={look.showBanks}
              className="size-4 rounded border-input"
              onChange={(event) =>
                onChange({ ...look, showBanks: event.target.checked, presetId: 'custom' })
              }
            />
            Show bank lines
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={look.showTerms}
              className="size-4 rounded border-input"
              onChange={(event) =>
                onChange({ ...look, showTerms: event.target.checked, presetId: 'custom' })
              }
            />
            Show terms
          </label>
        </div>

        {onReset ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => {
              onChange({
                ...DEFAULT_TEMPLATE_LOOK,
                accent: look.accent,
                title: look.title,
              })
              onReset()
            }}
          >
            Reset style
          </Button>
        ) : null}
      </aside>
    </div>
  )
}

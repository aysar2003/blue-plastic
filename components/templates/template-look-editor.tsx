'use client'

import { TemplateLayoutPreview } from '@/components/templates/template-layout-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DEFAULT_TEMPLATE_LOOK,
  TEMPLATE_LOOK_FONTS,
  type TemplateLook,
} from '@/lib/template-look'

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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
      <div
        className="overflow-hidden rounded-lg bg-white shadow-sm"
        style={{
          border: `${look.borderWidth}px solid ${look.borderColor}`,
          fontFamily: look.fontFamily,
          fontSize: look.fontSize,
          fontWeight: look.fontWeight,
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2" style={{ borderColor: look.borderColor }}>
          {look.showLogo ? (
            <span
              className="grid size-10 place-items-center rounded border border-dashed text-[10px] text-slate-400"
              style={{ borderColor: look.borderColor }}
            >
              Logo
            </span>
          ) : (
            <span />
          )}
          <span className="font-semibold" style={{ color: look.accent }}>
            {look.title || layoutLabel}
          </span>
        </div>
        <TemplateLayoutPreview kind={layoutId} accent={look.accent} size="stage" className="rounded-none border-0 shadow-none" />
      </div>

      <aside className="space-y-2 rounded-lg border border-border bg-background p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Style</p>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Title</span>
          <Input
            value={look.title}
            placeholder={layoutLabel}
            className="h-8"
            onChange={(event) => onChange({ ...look, title: event.target.value })}
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Font type</span>
          <select
            value={look.fontFamily}
            className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
            onChange={(event) => onChange({ ...look, fontFamily: event.target.value })}
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
            onChange={(event) => onChange({ ...look, fontSize: Number(event.target.value) })}
          />
        </label>

        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant={look.fontWeight === 'bold' ? 'default' : 'outline'}
            onClick={() =>
              onChange({ ...look, fontWeight: look.fontWeight === 'bold' ? 'normal' : 'bold' })
            }
          >
            Bold
          </Button>
        </div>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Accent / style colour</span>
          <Input
            type="color"
            value={look.accent}
            className="h-8 w-full p-1"
            onChange={(event) => onChange({ ...look, accent: event.target.value })}
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">Border colour</span>
          <Input
            type="color"
            value={look.borderColor}
            className="h-8 w-full p-1"
            onChange={(event) => onChange({ ...look, borderColor: event.target.value })}
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
            onChange={(event) => onChange({ ...look, borderWidth: Number(event.target.value) })}
          />
        </label>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={look.showLogo}
            className="size-4 rounded border-input"
            onChange={(event) => onChange({ ...look, showLogo: event.target.checked })}
          />
          Show logo frame
        </label>

        {onReset ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              onChange({ ...DEFAULT_TEMPLATE_LOOK, accent: look.accent })
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

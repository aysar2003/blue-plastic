'use client'

import { useEffect, useState } from 'react'
import { CheckIcon, Eye, Pencil } from 'lucide-react'

import { TemplateLayoutPreview } from '@/components/templates/template-layout-preview'
import { TemplateLookEditor } from '@/components/templates/template-look-editor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import {
  parseTemplateLook,
  serializeTemplateLook,
  templateLookStorageKey,
  type TemplateLook,
} from '@/lib/template-look'
import { cn } from '@/lib/utils'

type Option = { id: string; label: string; blurb: string }

export function FormLayoutPicker({
  title,
  description,
  storageKey,
  options,
  defaultId,
  parse,
  persistHint = 'Saved in this browser. Sales screens open on the layout you pick here.',
  accent,
}: {
  title: string
  description: string
  storageKey: string
  options: readonly Option[]
  defaultId: string
  parse: (raw: string | null | undefined) => string
  persistHint?: string
  accent?: string
}) {
  const saved = useBrowserStore(storageKey)
  const current = parse(saved) || defaultId
  const [viewId, setViewId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [draftLook, setDraftLook] = useState<TemplateLook | null>(null)
  const [looks, setLooks] = useState<Record<string, TemplateLook>>({})
  const [lookTick, setLookTick] = useState(0)

  useEffect(() => {
    const next: Record<string, TemplateLook> = {}
    for (const option of options) {
      const raw = window.localStorage.getItem(templateLookStorageKey(storageKey, option.id))
      next[option.id] = parseTemplateLook(raw, accent)
    }
    setLooks(next)
  }, [options, storageKey, accent, lookTick])

  const viewOption = options.find((option) => option.id === viewId) ?? null
  const editOption = options.find((option) => option.id === editId) ?? null

  function openEdit(option: Option) {
    writeBrowserStore(storageKey, option.id)
    const raw = window.localStorage.getItem(templateLookStorageKey(storageKey, option.id))
    setDraftLook(parseTemplateLook(raw, accent))
    setViewId(null)
    setEditId(option.id)
  }

  function saveEdit() {
    if (!editOption || !draftLook) return
    writeBrowserStore(templateLookStorageKey(storageKey, editOption.id), serializeTemplateLook(draftLook))
    setLookTick((value) => value + 1)
    setEditId(null)
    setDraftLook(null)
  }

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => {
          const active = option.id === current
          const look = looks[option.id] ?? parseTemplateLook(null, accent)
          return (
            <div
              key={option.id}
              className={cn(
                'rounded-xl border px-3 py-3 text-left transition-colors',
                active
                  ? 'border-primary bg-accent/40 ring-2 ring-primary/25'
                  : 'border-border bg-background',
              )}
            >
              <button
                type="button"
                aria-pressed={active}
                onClick={() => writeBrowserStore(storageKey, option.id)}
                className="w-full text-left"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{option.label}</span>
                  {active ? <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                </span>
                <span className="mt-1 block text-xs leading-snug text-muted-foreground">{option.blurb}</span>
                <div
                  className="mt-3 overflow-hidden rounded-lg"
                  style={{
                    border: `${look.borderWidth}px solid ${look.borderColor}`,
                    fontFamily: look.fontFamily,
                  }}
                >
                  <TemplateLayoutPreview kind={option.id} accent={look.accent} />
                </div>
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditId(null)
                    setDraftLook(null)
                    setViewId(option.id)
                  }}
                >
                  <Eye className="size-3.5" />
                  View
                </Button>
                <Button type="button" size="sm" variant={active ? 'default' : 'secondary'} onClick={() => openEdit(option)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{persistHint}</p>

      <Dialog open={viewOption != null} onOpenChange={(open) => !open && setViewId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>View · {viewOption?.label}</DialogTitle>
            <DialogDescription>Sida template-kan u muuqdo — how this layout looks.</DialogDescription>
          </DialogHeader>
          {viewOption ? (
            <TemplateLayoutPreview
              kind={viewOption.id}
              accent={(looks[viewOption.id] ?? parseTemplateLook(null, accent)).accent}
              size="stage"
              className="mx-auto"
            />
          ) : null}
          <p className="text-xs text-muted-foreground">{viewOption?.blurb}</p>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOption != null && draftLook != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditId(null)
            setDraftLook(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit · {editOption?.label}</DialogTitle>
            <DialogDescription>
              Size, font type, style colour, logo frame, and border — saved on this browser for this template.
            </DialogDescription>
          </DialogHeader>
          {editOption && draftLook ? (
            <TemplateLookEditor
              layoutId={editOption.id}
              layoutLabel={editOption.label}
              look={draftLook}
              onChange={setDraftLook}
              onReset={() => {
                writeBrowserStore(templateLookStorageKey(storageKey, editOption.id), null)
                setLookTick((value) => value + 1)
              }}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveEdit}>
              Save style
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditId(null)
                setDraftLook(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

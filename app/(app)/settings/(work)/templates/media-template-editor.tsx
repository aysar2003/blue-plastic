'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageIcon, Plus, Save, Trash2, Upload, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  deleteTemplateMedia,
  getTemplateMedia,
  putTemplateMedia,
  sniffLogoImage,
  type TemplateMediaMeta,
} from '@/lib/custom-template-media'
import {
  createOverlayBlock,
  moveOverlayBlock,
  OVERLAY_BLOCK_KINDS,
  overlayLogoStorageKey,
  parseTemplateOverlay,
  resizeOverlayBlock,
  type OverlayBlock,
  type OverlayBlockKind,
  type TemplateOverlay,
} from '@/lib/template-overlay'
import { cn } from '@/lib/utils'

type DragMode = 'move' | 'resize'

export function MediaTemplateEditor({
  templateId,
  templateName,
  meta,
  initialOverlay,
  onSave,
  onClose,
}: {
  templateId: string
  templateName: string
  meta: TemplateMediaMeta
  initialOverlay?: TemplateOverlay
  onSave: (overlay: TemplateOverlay) => void
  onClose: () => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<OverlayBlock[]>(() => parseTemplateOverlay(initialOverlay).blocks)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const dragRef = useRef<{
    id: string
    mode: DragMode
    startX: number
    startY: number
    origin: OverlayBlock
  } | null>(null)

  const selected = blocks.find((block) => block.id === selectedId) ?? null

  useEffect(() => {
    let revoked: string | null = null
    let cancelled = false
    void (async () => {
      try {
        const blob = await getTemplateMedia(templateId)
        if (cancelled) return
        if (!blob) {
          setError('File is missing in this browser. Upload it again.')
          return
        }
        const objectUrl = URL.createObjectURL(blob)
        revoked = objectUrl
        setUrl(objectUrl)
      } catch {
        if (!cancelled) setError('Could not read that file.')
      }
    })()
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [templateId])

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current
      const stage = stageRef.current
      if (!drag || !stage) return
      const rect = stage.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const dx = ((event.clientX - drag.startX) / rect.width) * 100
      const dy = ((event.clientY - drag.startY) / rect.height) * 100
      setBlocks((current) =>
        current.map((block) => {
          if (block.id !== drag.id) return block
          if (drag.mode === 'move') {
            return moveOverlayBlock(drag.origin, drag.origin.x + dx, drag.origin.y + dy)
          }
          return resizeOverlayBlock(drag.origin, drag.origin.w + dx, drag.origin.h + dy)
        }),
      )
    }

    function onUp() {
      dragRef.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  function addBlock(kind: OverlayBlockKind) {
    if (kind === 'logo') {
      logoInputRef.current?.click()
      return
    }
    const block = createOverlayBlock(kind, {
      x: 10 + (blocks.length % 5) * 4,
      y: 12 + (blocks.length % 5) * 5,
    })
    setBlocks((current) => [...current, block])
    setSelectedId(block.id)
    setNote(`Added ${kind}. Jiid si aad u dhaqaajiso — drag to move.`)
  }

  async function addLogoFromFile(file: File) {
    const sniffed = sniffLogoImage(file)
    if (!sniffed.ok) {
      setNote(sniffed.error)
      return
    }
    const block = createOverlayBlock('logo', {
      x: 6,
      y: 4,
      text: sniffed.meta.fileName,
    })
    const logoKey = overlayLogoStorageKey(templateId, block.id)
    try {
      await putTemplateMedia(logoKey, file)
    } catch {
      setNote('Could not store that logo in this browser.')
      return
    }
    const withKey = { ...block, logoKey }
    setBlocks((current) => [...current, withKey])
    setSelectedId(block.id)
    setNote(`Logo “${sniffed.meta.fileName}” added. Jiid / resize, then Save layout.`)
  }

  async function addCompanyLogo() {
    try {
      const response = await fetch('/api/organization/logo')
      if (!response.ok) {
        setNote('No company logo yet. Upload one under Organisation, or pick a logo file here.')
        return
      }
      const blob = await response.blob()
      if (!blob.type.startsWith('image/')) {
        setNote('Company logo could not be read as an image.')
        return
      }
      const file = new File([blob], 'company-logo.png', { type: blob.type || 'image/png' })
      await addLogoFromFile(file)
    } catch {
      setNote('Could not load the company logo.')
    }
  }

  async function replaceSelectedLogo(file: File) {
    if (!selected || selected.kind !== 'logo') return
    const sniffed = sniffLogoImage(file)
    if (!sniffed.ok) {
      setNote(sniffed.error)
      return
    }
    const logoKey = selected.logoKey ?? overlayLogoStorageKey(templateId, selected.id)
    try {
      await putTemplateMedia(logoKey, file)
    } catch {
      setNote('Could not store that logo.')
      return
    }
    updateSelected({ text: sniffed.meta.fileName, logoKey })
    setNote(`Logo replaced with “${sniffed.meta.fileName}”.`)
  }

  function updateSelected(patch: Partial<OverlayBlock> | { style: Partial<OverlayBlock['style']> }) {
    if (!selectedId) return
    setBlocks((current) =>
      current.map((block) => {
        if (block.id !== selectedId) return block
        if ('style' in patch && patch.style) {
          return { ...block, style: { ...block.style, ...patch.style } }
        }
        return { ...block, ...(patch as Partial<OverlayBlock>) }
      }),
    )
  }

  async function removeSelected() {
    if (!selectedId) return
    const target = blocks.find((block) => block.id === selectedId)
    if (target?.logoKey) await deleteTemplateMedia(target.logoKey).catch(() => undefined)
    setBlocks((current) => current.filter((block) => block.id !== selectedId))
    setSelectedId(null)
    setNote('Block removed.')
  }

  function save() {
    onSave({ blocks })
    setNote('Layout saved — including logos, positions, and styles.')
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">Edit · {templateName}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Logo ku soo dar, jiid, style beddel. Add logo, drag blocks, change colour / size.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={save}>
            <Save className="size-3.5" />
            Save layout
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            <X className="size-3.5" />
            Close
          </Button>
        </div>
      </div>

      <input
        ref={logoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          await addLogoFromFile(file)
        }}
      />

      <div className="flex flex-wrap gap-2">
        {OVERLAY_BLOCK_KINDS.map((option) => (
          <Button key={option.id} type="button" size="sm" variant="outline" onClick={() => addBlock(option.id)}>
            {option.id === 'logo' ? <ImageIcon className="size-3.5" /> : <Plus className="size-3.5" />}
            {option.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="secondary" onClick={() => void addCompanyLogo()}>
          <ImageIcon className="size-3.5" />
          Company logo
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div
          ref={stageRef}
          className="relative min-h-[28rem] overflow-hidden rounded-lg border border-border bg-background"
          onPointerDown={() => setSelectedId(null)}
        >
          {error ? <p className="p-4 text-sm text-destructive">{error}</p> : null}
          {!error && !url ? <p className="p-4 text-sm text-muted-foreground">Reading file…</p> : null}
          {url && meta.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob preview
            <img src={url} alt={meta.fileName} className="absolute inset-0 h-full w-full object-contain" />
          ) : null}
          {url && meta.kind === 'pdf' ? (
            <iframe title={meta.fileName} src={url} className="absolute inset-0 h-full w-full bg-card" />
          ) : null}

          {blocks.map((block) => {
            const active = block.id === selectedId
            return (
              <div
                key={block.id}
                role="button"
                tabIndex={0}
                aria-label={block.text || block.kind}
                className={cn(
                  'absolute touch-none select-none overflow-hidden rounded-sm',
                  active ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-primary/50',
                )}
                style={{
                  left: `${block.x}%`,
                  top: `${block.y}%`,
                  width: `${block.w}%`,
                  height: `${block.h}%`,
                  color: block.style.color,
                  background: block.kind === 'logo' ? block.style.background : block.style.background,
                  fontSize: block.style.fontSize,
                  fontWeight: block.style.fontWeight,
                  textAlign: block.style.align,
                  opacity: block.style.opacity,
                  border: `${block.style.borderWidth}px solid ${block.style.borderColor}`,
                  cursor: 'grab',
                  padding: block.kind === 'logo' ? 0 : '2px 4px',
                  lineHeight: 1.25,
                }}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  event.preventDefault()
                  setSelectedId(block.id)
                  dragRef.current = {
                    id: block.id,
                    mode: 'move',
                    startX: event.clientX,
                    startY: event.clientY,
                    origin: block,
                  }
                }}
              >
                {block.kind === 'logo' ? (
                  block.logoKey ? (
                    <OverlayLogoImage logoKey={block.logoKey} objectFit={block.style.objectFit} alt={block.text} />
                  ) : (
                    <span className="grid h-full place-items-center text-[10px] text-muted-foreground">Logo</span>
                  )
                ) : block.kind === 'box' ? null : (
                  <span className="block h-full w-full break-words">{block.text}</span>
                )}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute bottom-0 right-0 size-3 cursor-se-resize rounded-sm bg-primary"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      event.preventDefault()
                      dragRef.current = {
                        id: block.id,
                        mode: 'resize',
                        startX: event.clientX,
                        startY: event.clientY,
                        origin: block,
                      }
                    }}
                  />
                ) : null}
              </div>
            )
          })}
        </div>

        <aside className="space-y-3 rounded-lg border border-border bg-background p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Style</p>
          {!selected ? (
            <p className="text-xs text-muted-foreground">
              Dooro block ama Logo ku dar — click a block, or add a logo to drag on the paper.
            </p>
          ) : (
            <div className="space-y-2">
              {selected.kind === 'logo' ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Logo: <span className="font-medium text-foreground">{selected.text || 'image'}</span>
                  </p>
                  <label className="inline-flex cursor-pointer items-center">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                      className="sr-only"
                      onChange={async (event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (!file) return
                        await replaceSelectedLogo(file)
                      }}
                    />
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-xs font-medium hover:bg-accent">
                      <Upload className="size-3.5" />
                      Replace logo
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={selected.style.objectFit === 'contain' ? 'default' : 'outline'}
                      onClick={() => updateSelected({ style: { objectFit: 'contain' } })}
                    >
                      Contain
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={selected.style.objectFit === 'cover' ? 'default' : 'outline'}
                      onClick={() => updateSelected({ style: { objectFit: 'cover' } })}
                    >
                      Cover
                    </Button>
                  </div>
                </>
              ) : (
                <label className="block space-y-1 text-xs">
                  <span className="text-muted-foreground">Text</span>
                  <textarea
                    value={selected.text}
                    rows={3}
                    className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                    onChange={(event) => updateSelected({ text: event.target.value })}
                  />
                </label>
              )}
              {selected.kind !== 'logo' ? (
                <label className="block space-y-1 text-xs">
                  <span className="text-muted-foreground">Text colour</span>
                  <Input
                    type="color"
                    value={toColorInput(selected.style.color)}
                    className="h-8 w-full p-1"
                    onChange={(event) => updateSelected({ style: { color: event.target.value } })}
                  />
                </label>
              ) : null}
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">Background</span>
                <Input
                  type="color"
                  value={toColorInput(selected.style.background)}
                  className="h-8 w-full p-1"
                  onChange={(event) => updateSelected({ style: { background: event.target.value } })}
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">Border</span>
                <Input
                  type="color"
                  value={toColorInput(selected.style.borderColor)}
                  className="h-8 w-full p-1"
                  onChange={(event) => updateSelected({ style: { borderColor: event.target.value } })}
                />
              </label>
              {selected.kind !== 'logo' ? (
                <label className="block space-y-1 text-xs">
                  <span className="text-muted-foreground">Size {selected.style.fontSize}px</span>
                  <input
                    type="range"
                    min={8}
                    max={48}
                    value={selected.style.fontSize}
                    className="w-full"
                    onChange={(event) =>
                      updateSelected({ style: { fontSize: Number(event.target.value) } })
                    }
                  />
                </label>
              ) : null}
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">Opacity</span>
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={selected.style.opacity}
                  className="w-full"
                  onChange={(event) =>
                    updateSelected({ style: { opacity: Number(event.target.value) } })
                  }
                />
              </label>
              {selected.kind !== 'logo' ? (
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={selected.style.fontWeight === 'bold' ? 'default' : 'outline'}
                    onClick={() =>
                      updateSelected({
                        style: { fontWeight: selected.style.fontWeight === 'bold' ? 'normal' : 'bold' },
                      })
                    }
                  >
                    Bold
                  </Button>
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <Button
                      key={align}
                      type="button"
                      size="sm"
                      variant={selected.style.align === align ? 'default' : 'outline'}
                      onClick={() => updateSelected({ style: { align } })}
                    >
                      {align}
                    </Button>
                  ))}
                </div>
              ) : null}
              <Button type="button" size="sm" variant="outline" onClick={() => void removeSelected()}>
                <Trash2 className="size-3.5" />
                Delete block
              </Button>
            </div>
          )}
          {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
        </aside>
      </div>
    </div>
  )
}

function OverlayLogoImage({
  logoKey,
  objectFit,
  alt,
}: {
  logoKey: string
  objectFit: 'contain' | 'cover'
  alt: string
}) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let revoked: string | null = null
    let cancelled = false
    void (async () => {
      const blob = await getTemplateMedia(logoKey)
      if (cancelled) return
      if (!blob) return
      const objectUrl = URL.createObjectURL(blob)
      revoked = objectUrl
      setSrc(objectUrl)
    })()
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [logoKey])

  if (!src) {
    return <span className="grid h-full place-items-center text-[10px] text-muted-foreground">…</span>
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob logo from IndexedDB
    <img src={src} alt={alt || 'Logo'} className="h-full w-full" style={{ objectFit }} draggable={false} />
  )
}

function toColorInput(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value
  return '#22d3ee'
}

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { ExternalLink, Eye, Pencil, Plus, Trash2, Upload } from 'lucide-react'

import { updateDocumentTemplate } from '@/app/(app)/settings/(work)/organization/actions'
import { MediaTemplateEditor } from '@/app/(app)/settings/(work)/templates/media-template-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBrowserStore, writeBrowserStore } from '@/lib/browser-store'
import {
  CUSTOM_FORM_TEMPLATE_KINDS,
  CUSTOM_FORM_TEMPLATES_KEY,
  newCustomTemplateId,
  parseCustomFormTemplates,
  serializeCustomFormTemplates,
  type CustomFormTemplate,
  type CustomFormTemplateKind,
} from '@/lib/custom-form-templates'
import {
  accentFromImageBlob,
  deleteTemplateMedia,
  formatMediaSize,
  getTemplateMedia,
  putTemplateMedia,
  sniffTemplateMedia,
  type TemplateMediaMeta,
} from '@/lib/custom-template-media'
import { parseDocumentTemplate, type DocumentTemplate } from '@/lib/document-template'
import {
  DEFAULT_INVOICE_FORM_TEMPLATE,
  DEFAULT_SALES_FORM_TEMPLATE,
  DEFAULT_SALES_RECEIPT_FORM_TEMPLATE,
  INVOICE_FORM_TEMPLATE_STORAGE_KEY,
  SALES_FORM_TEMPLATE_STORAGE_KEY,
  SALES_RECEIPT_FORM_TEMPLATE_STORAGE_KEY,
} from '@/lib/sales-form-templates'
import type { TemplateOverlay } from '@/lib/template-overlay'

type MediaDraft = { meta: TemplateMediaMeta; blob: Blob }

export function MyTemplatesPanel({
  currentDocument,
  canEdit,
}: {
  currentDocument: DocumentTemplate
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const raw = useBrowserStore(CUSTOM_FORM_TEMPLATES_KEY)
  const templates = parseCustomFormTemplates(raw)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CustomFormTemplateKind>('media')
  const [note, setNote] = useState('')
  const [formLayoutId, setFormLayoutId] = useState('sheet')
  const [message, setMessage] = useState<string | null>(null)
  const [uploadDraft, setUploadDraft] = useState<DocumentTemplate | null>(null)
  const [mediaDraft, setMediaDraft] = useState<MediaDraft | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  function saveList(next: CustomFormTemplate[]) {
    writeBrowserStore(CUSTOM_FORM_TEMPLATES_KEY, serializeCustomFormTemplates(next))
  }

  async function addTemplate(document?: DocumentTemplate) {
    const trimmed = name.trim()
    if (!trimmed) {
      setMessage('Give the template a name first.')
      return
    }

    if (kind === 'media' && !mediaDraft) {
      setMessage('Upload a PDF or image first, then save.')
      return
    }

    const id = newCustomTemplateId()
    if (mediaDraft) {
      try {
        await putTemplateMedia(id, mediaDraft.blob)
      } catch {
        setMessage('Could not store that PDF/image in this browser.')
        return
      }
    }

    const entry: CustomFormTemplate = {
      id,
      name: trimmed,
      kind: mediaDraft ? 'media' : kind,
      note: note.trim(),
      createdAt: new Date().toISOString(),
      document:
        kind === 'document'
          ? parseDocumentTemplate(document ?? uploadDraft ?? currentDocument)
          : undefined,
      formLayoutId:
        kind === 'document' || kind === 'other' || kind === 'media' ? undefined : formLayoutId,
      media: mediaDraft?.meta,
    }
    saveList([entry, ...templates])
    setName('')
    setNote('')
    setUploadDraft(null)
    setMediaDraft(null)
    setMessage(`Saved “${trimmed}”. Open, take, or apply it from the list.`)
  }

  async function removeTemplate(id: string) {
    const target = templates.find((item) => item.id === id)
    await deleteTemplateMedia(id).catch(() => undefined)
    for (const block of target?.overlay?.blocks ?? []) {
      if (block.logoKey) await deleteTemplateMedia(block.logoKey).catch(() => undefined)
    }
    if (previewId === id) setPreviewId(null)
    if (editId === id) setEditId(null)
    saveList(templates.filter((item) => item.id !== id))
    setMessage('Template removed.')
  }

  function saveOverlay(id: string, overlay: TemplateOverlay) {
    saveList(
      templates.map((item) =>
        item.id === id
          ? { ...item, overlay: overlay.blocks.length > 0 ? overlay : undefined }
          : item,
      ),
    )
    setMessage('Layout saved — drag positions and styles are kept on this template.')
  }

  async function takeMedia(item: CustomFormTemplate) {
    if (!item.media) {
      setMessage('This template has no PDF or image file.')
      return
    }
    const blob = await getTemplateMedia(item.id)
    if (!blob) {
      setMessage('File is missing in this browser. Upload it again.')
      return
    }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = item.media.fileName
    link.target = '_blank'
    link.rel = 'noreferrer'
    link.click()
    // Keep the blob URL briefly so the download can start.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    setMessage(`Took “${item.media.fileName}” — downloaded / opened.`)
  }

  async function createPaperFromImage(item: CustomFormTemplate) {
    if (!item.media || item.media.kind !== 'image') {
      setMessage('Only an image can be sampled for invoice colour.')
      return
    }
    if (!canEdit) {
      setMessage('You need permission to change the company paper.')
      return
    }
    const blob = await getTemplateMedia(item.id)
    if (!blob) {
      setMessage('Image is missing in this browser. Upload it again.')
      return
    }
    const accent = (await accentFromImageBlob(blob)) ?? currentDocument.accent
    startTransition(async () => {
      const result = await updateDocumentTemplate({
        accent,
        terms: currentDocument.terms,
        footerTitle: currentDocument.footerTitle,
        footerNote: currentDocument.footerNote,
        footerLayout: currentDocument.footerLayout,
        showClassicPaper: currentDocument.showClassicPaper,
        paperStyle: currentDocument.paperStyle,
        banks: currentDocument.banks,
      })
      if (!result.ok) {
        setMessage(result.error.message)
        return
      }
      setMessage(`Created company paper colour ${accent} from “${item.name}”.`)
      router.refresh()
    })
  }

  function applyTemplate(item: CustomFormTemplate) {
    if (item.media) {
      void takeMedia(item)
      return
    }

    if (item.kind === 'document' && item.document) {
      if (!canEdit) {
        setMessage('You need permission to change the company paper.')
        return
      }
      startTransition(async () => {
        const result = await updateDocumentTemplate({
          accent: item.document!.accent,
          terms: item.document!.terms,
          footerTitle: item.document!.footerTitle,
          footerNote: item.document!.footerNote,
          footerLayout: item.document!.footerLayout,
          showClassicPaper: item.document!.showClassicPaper,
          paperStyle: item.document!.paperStyle,
          banks: item.document!.banks,
        })
        if (!result.ok) {
          setMessage(result.error.message)
          return
        }
        setMessage(`Applied “${item.name}” to invoice & statement paper.`)
        router.refresh()
      })
      return
    }

    if (item.kind === 'invoice-form' && item.formLayoutId) {
      writeBrowserStore(INVOICE_FORM_TEMPLATE_STORAGE_KEY, item.formLayoutId)
      setMessage(`Invoice forms will open as “${item.formLayoutId}”.`)
      return
    }
    if (item.kind === 'sales-receipt-form' && item.formLayoutId) {
      writeBrowserStore(SALES_RECEIPT_FORM_TEMPLATE_STORAGE_KEY, item.formLayoutId)
      setMessage(`Sales receipts will open as “${item.formLayoutId}”.`)
      return
    }
    if (item.kind === 'sales-form' && item.formLayoutId) {
      writeBrowserStore(SALES_FORM_TEMPLATE_STORAGE_KEY, item.formLayoutId)
      setMessage(`Other sales forms will open as “${item.formLayoutId}”.`)
      return
    }

    setMessage(
      item.note
        ? `“${item.name}” is saved for later. ${item.note}`
        : `“${item.name}” is saved as a placeholder — edit or upload paper when you are ready.`,
    )
  }

  async function onMediaFile(file: File) {
    const sniffed = sniffTemplateMedia(file)
    if (!sniffed.ok) {
      setMessage(sniffed.error)
      return
    }
    setKind('media')
    setMediaDraft({ meta: sniffed.meta, blob: file })
    if (!name.trim()) setName(file.name.replace(/\.(pdf|jpe?g|png|webp|gif)$/i, ''))
    setMessage(
      sniffed.meta.kind === 'pdf'
        ? `PDF ready (${formatMediaSize(file.size)}). Save to keep it, then Open or Take.`
        : `Image ready (${formatMediaSize(file.size)}). Save to keep it — you can also make paper colour from it.`,
    )
  }

  return (
    <section className="space-y-4 rounded-md border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">My templates</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF ama sawir soo geli, akhri, Edit → jiid jiid, qoraal iyo style beddel, Save. Upload,
          read, drag blocks, restyle, then take or keep the layout.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-dashed border-border bg-background/60 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Add a template</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Template name"
            aria-label="Template name"
          />
          <select
            className="h-8 rounded-md border border-input bg-card px-2 text-sm"
            value={kind}
            aria-label="Template kind"
            onChange={(event) => setKind(event.target.value as CustomFormTemplateKind)}
          >
            {CUSTOM_FORM_TEMPLATE_KINDS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note (optional) — e.g. Hormud banks, hospital branch"
          aria-label="Template note"
        />
        {kind !== 'document' && kind !== 'other' && kind !== 'media' ? (
          <Input
            value={formLayoutId}
            onChange={(event) => setFormLayoutId(event.target.value)}
            placeholder={`Layout id — e.g. ${DEFAULT_INVOICE_FORM_TEMPLATE}`}
            aria-label="Form layout id"
          />
        ) : null}
        {kind === 'other' ? (
          <p className="text-xs text-muted-foreground">
            Placeholder for a layout you will finish later. Defaults if empty:{' '}
            {DEFAULT_SALES_FORM_TEMPLATE} / {DEFAULT_SALES_RECEIPT_FORM_TEMPLATE}.
          </p>
        ) : null}

        {mediaDraft ? (
          <p className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            Ready: <span className="font-medium text-foreground">{mediaDraft.meta.fileName}</span>
            {' · '}
            {mediaDraft.meta.kind.toUpperCase()}
            {' · '}
            {formatMediaSize(mediaDraft.meta.sizeBytes)}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center">
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,.pdf,.jpg,.jpeg,.png,.webp,.gif"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                await onMediaFile(file)
              }}
            />
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-xs font-medium hover:bg-accent">
              <Upload className="size-3.5" />
              Upload PDF / image
            </span>
          </label>

          {kind === 'document' ? (
            <>
              <Button type="button" size="sm" disabled={!canEdit} onClick={() => void addTemplate(currentDocument)}>
                <Plus className="size-3.5" />
                Save current paper
              </Button>
              <label className="inline-flex cursor-pointer items-center">
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  disabled={!canEdit}
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    try {
                      const parsed = parseDocumentTemplate(JSON.parse(await file.text()))
                      setUploadDraft(parsed)
                      setMediaDraft(null)
                      if (!name.trim()) setName(file.name.replace(/\.json$/i, ''))
                      setMessage(`Loaded ${file.name}. Click “Save JSON” to keep it.`)
                    } catch {
                      setMessage('That file is not a document template JSON.')
                    }
                  }}
                />
                <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-xs font-medium hover:bg-accent">
                  <Upload className="size-3.5" />
                  Upload JSON
                </span>
              </label>
              {uploadDraft ? (
                <Button type="button" size="sm" variant="secondary" disabled={!canEdit} onClick={() => void addTemplate(uploadDraft)}>
                  Save JSON
                </Button>
              ) : null}
            </>
          ) : null}

          <Button
            type="button"
            size="sm"
            onClick={() => void addTemplate()}
            disabled={kind === 'media' && !mediaDraft}
          >
            <Plus className="size-3.5" />
            Save template
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <p className="rounded-xl border border-border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
          No custom templates yet. Upload a PDF or invoice photo to start — the system will keep it
          here so you can open or take it later.
        </p>
      ) : (
        <ul className="space-y-2">
          {templates.map((item) => {
            const kindLabel =
              CUSTOM_FORM_TEMPLATE_KINDS.find((entry) => entry.id === item.kind)?.label ?? item.kind
            return (
              <li
                key={item.id}
                className="space-y-3 rounded-xl border border-border bg-background px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {kindLabel}
                      {item.formLayoutId ? ` · ${item.formLayoutId}` : null}
                      {item.document ? ` · ${item.document.accent}` : null}
                      {item.media
                        ? ` · ${item.media.kind.toUpperCase()} · ${item.media.fileName} · ${formatMediaSize(item.media.sizeBytes)}`
                        : null}
                      {item.overlay?.blocks.length
                        ? ` · ${item.overlay.blocks.length} edited block${item.overlay.blocks.length === 1 ? '' : 's'}`
                        : null}
                    </p>
                    {item.note ? <p className="mt-1 text-xs text-muted-foreground">{item.note}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.media ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditId(null)
                            setPreviewId((current) => (current === item.id ? null : item.id))
                          }}
                        >
                          <Eye className="size-3.5" />
                          {previewId === item.id ? 'Hide' : 'Read'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={editId === item.id ? 'default' : 'secondary'}
                          onClick={() => {
                            setPreviewId(null)
                            setEditId((current) => (current === item.id ? null : item.id))
                          }}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button type="button" size="sm" onClick={() => void takeMedia(item)}>
                          <ExternalLink className="size-3.5" />
                          Take
                        </Button>
                        {item.media.kind === 'image' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending || !canEdit}
                            onClick={() => void createPaperFromImage(item)}
                          >
                            Make paper colour
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending || (item.kind === 'document' && !canEdit)}
                        onClick={() => applyTemplate(item)}
                      >
                        Apply
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void removeTemplate(item.id)}
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {previewId === item.id && item.media ? (
                  <MediaPreview templateId={item.id} meta={item.media} overlay={item.overlay} />
                ) : null}
                {editId === item.id && item.media ? (
                  <MediaTemplateEditor
                    templateId={item.id}
                    templateName={item.name}
                    meta={item.media}
                    initialOverlay={item.overlay}
                    onSave={(overlay) => saveOverlay(item.id, overlay)}
                    onClose={() => setEditId(null)}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <p className="text-[11px] text-muted-foreground">
        Names stay in this browser; PDF/image files are stored locally in IndexedDB so the system can
        read and take them. Applying JSON paper updates the company template for everyone.
      </p>
    </section>
  )
}

function MediaPreview({
  templateId,
  meta,
  overlay,
}: {
  templateId: string
  meta: TemplateMediaMeta
  overlay?: TemplateOverlay
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const blocks = overlay?.blocks ?? []

  useEffect(() => {
    let revoked: string | null = null
    let cancelled = false
    void (async () => {
      try {
        const blob = await getTemplateMedia(templateId)
        if (cancelled) return
        if (!blob) {
          setError('File is missing in this browser.')
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

  if (error) return <p className="text-xs text-destructive">{error}</p>
  if (!url) return <p className="text-xs text-muted-foreground">Reading file…</p>

  return (
    <div className="relative min-h-80 overflow-hidden rounded-lg border border-border bg-card">
      {meta.kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob: preview from IndexedDB
        <img src={url} alt={meta.fileName} className="max-h-96 w-full object-contain" />
      ) : (
        <iframe title={meta.fileName} src={url} className="h-96 w-full" />
      )}
      {blocks.map((block) => (
        <div
          key={block.id}
          className="pointer-events-none absolute overflow-hidden rounded-sm"
          style={{
            left: `${block.x}%`,
            top: `${block.y}%`,
            width: `${block.w}%`,
            height: `${block.h}%`,
            color: block.style.color,
            background: block.style.background,
            fontSize: block.style.fontSize,
            fontWeight: block.style.fontWeight,
            textAlign: block.style.align,
            opacity: block.style.opacity,
            border: `${block.style.borderWidth}px solid ${block.style.borderColor}`,
            padding: block.kind === 'logo' ? 0 : '2px 4px',
            lineHeight: 1.25,
          }}
        >
          {block.kind === 'logo' && block.logoKey ? (
            <PreviewLogo logoKey={block.logoKey} objectFit={block.style.objectFit} alt={block.text} />
          ) : block.kind === 'box' || block.kind === 'logo' ? null : (
            block.text
          )}
        </div>
      ))}
    </div>
  )
}

function PreviewLogo({
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
      if (cancelled || !blob) return
      const objectUrl = URL.createObjectURL(blob)
      revoked = objectUrl
      setSrc(objectUrl)
    })()
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [logoKey])

  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob logo preview
    <img src={src} alt={alt || 'Logo'} className="h-full w-full" style={{ objectFit }} />
  )
}

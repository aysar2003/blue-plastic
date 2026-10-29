'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DownloadIcon,
  ExternalLinkIcon,
  FileImageIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  completeDocumentUpload,
  createFolder,
  deleteDocument,
  deleteFolder,
  moveDocument,
  prepareDocumentUpload,
} from '@/app/(app)/documents/actions'
import { PdfCanvasPreview } from '@/components/documents/pdf-canvas-preview'
import { Field } from '@/components/forms/field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/date'
import { cn } from '@/lib/utils'

const MAX_BYTES = 100 * 1024 * 1024

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type Folder = {
  id: string
  name: string
  systemKey: string | null
  isSystem: boolean
  sequence: number
  documentCount: number
}

type Doc = {
  id: string
  folderId: string | null
  title: string
  originalName: string
  contentType: string
  byteSize: number
  notes: string | null
  createdAt: string
  createdByName: string | null
}

type FilterKey = 'all' | 'unfiled' | string

export function DocumentsBoard({
  folders,
  unfiledCount,
  rows,
  canCreate,
  canUpdate,
  canDelete,
  timeZone,
}: {
  folders: Folder[]
  unfiledCount: number
  rows: Doc[]
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  timeZone: string
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadPending, setUploadPending] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [uploadFolderId, setUploadFolderId] = useState<string>('')
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [preview, setPreview] = useState<Doc | null>(null)

  useEffect(() => {
    if (!uploadOpen) return
    if (filter !== 'all' && filter !== 'unfiled') {
      setUploadFolderId(filter)
    } else if (!uploadFolderId && folders[0]) {
      setUploadFolderId(folders[0].id)
    }
  }, [uploadOpen, filter, folders, uploadFolderId])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (filter === 'unfiled' && row.folderId !== null) return false
      if (filter !== 'all' && filter !== 'unfiled' && row.folderId !== filter) return false
      if (!q) return true
      return (
        row.title.toLowerCase().includes(q) ||
        row.originalName.toLowerCase().includes(q) ||
        (row.notes?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [rows, filter, query])

  function remove(id: string, docTitle: string) {
    if (!window.confirm(`Delete “${docTitle}”? This cannot be undone.`)) return
    startBusy(async () => {
      const result = await deleteDocument({ id })
      if (result.ok) {
        toast.success('Deleted.')
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  function removeFolderRow(folder: Folder) {
    if (folder.isSystem) {
      toast.error('Built-in folders cannot be deleted.')
      return
    }
    if (
      !window.confirm(
        `Delete folder “${folder.name}”? Files inside move to Unfiled.`,
      )
    ) {
      return
    }
    startBusy(async () => {
      const result = await deleteFolder({ id: folder.id })
      if (result.ok) {
        if (filter === folder.id) setFilter('all')
        toast.success('Folder deleted.')
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  function addFolder() {
    const name = newFolderName.trim()
    if (!name) {
      toast.error('Enter a folder name.')
      return
    }
    startBusy(async () => {
      const result = await createFolder({ name })
      if (result.ok) {
        setNewFolderName('')
        setNewFolderOpen(false)
        setFilter(result.data.id)
        toast.success('Folder created.')
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  async function submitUpload() {
    if (!pickedFile) {
      setUploadError('Choose a PDF or image to upload.')
      return
    }
    if (pickedFile.size > MAX_BYTES) {
      setUploadError('Each file must be 100 MB or smaller.')
      return
    }

    setUploadPending(true)
    setUploadError(null)
    try {
      const prepared = await prepareDocumentUpload({
        fileName: pickedFile.name,
        contentType: pickedFile.type || 'application/octet-stream',
        byteSize: pickedFile.size,
      })
      if (!prepared.ok) {
        setUploadError(prepared.error.message)
        return
      }

      const put = await fetch(prepared.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': prepared.data.contentType },
        body: pickedFile,
      })
      if (!put.ok) {
        setUploadError('Could not send the file to storage. Check R2 CORS allows PUT from this site.')
        return
      }

      const finished = await completeDocumentUpload({
        storageKey: prepared.data.storageKey,
        fileName: prepared.data.fileName,
        contentType: prepared.data.contentType,
        byteSize: pickedFile.size,
        title: title.trim() || null,
        notes: notes.trim() || null,
        folderId: uploadFolderId || null,
      })
      if (!finished.ok) {
        setUploadError(finished.error.message)
        return
      }

      setShowNotes(false)
      setUploadOpen(false)
      setPickedFile(null)
      setTitle('')
      setNotes('')
      toast.success('Document saved.')
      router.refresh()
    } catch (error) {
      console.error('[documents/client-upload]', error)
      setUploadError('Could not upload the file.')
    } finally {
      setUploadPending(false)
    }
  }

  const sidebarFolders: { key: FilterKey; label: string; count: number; folder?: Folder }[] = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'unfiled', label: 'Unfiled', count: unfiledCount },
    ...folders.map((folder) => ({
      key: folder.id as FilterKey,
      label: folder.name,
      count: folder.documentCount,
      folder,
    })),
  ]

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-[clamp(0.75rem,2vw,2.5rem)] py-2.5">
        {canCreate ? (
          <>
            <Button type="button" size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
              <UploadIcon className="size-3.5" />
              Upload
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setNewFolderOpen((open) => !open)}
              className="gap-1.5"
            >
              <FolderPlusIcon className="size-3.5" />
              New folder
            </Button>
          </>
        ) : null}
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            className="h-8 pl-8"
            aria-label="Search documents"
          />
        </div>
        <div className="ml-auto flex items-center gap-0.5 rounded-md border border-border p-0.5">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
            className={cn(
              'rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground',
              view === 'grid' && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
            )}
          >
            <LayoutGridIcon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={cn(
              'rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground',
              view === 'list' && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
            )}
          >
            <ListIcon className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-card/60 py-3 md:block">
          <p className="px-4 pb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Workspace
          </p>
          <nav className="flex flex-col gap-0.5 px-2" aria-label="Document folders">
            {sidebarFolders.map((item) => (
              <div key={item.key} className="group relative">
                <button
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 pr-8 text-left text-sm transition-colors',
                    filter === item.key
                      ? 'bg-primary/12 font-medium text-primary'
                      : 'text-foreground/80 hover:bg-muted',
                  )}
                >
                  <FolderIcon className="size-3.5 shrink-0 opacity-70" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{item.count}</span>
                </button>
                {item.folder && !item.folder.isSystem && canDelete ? (
                  <button
                    type="button"
                    aria-label={`Delete folder ${item.folder.name}`}
                    disabled={busy}
                    onClick={() => removeFolderRow(item.folder!)}
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2Icon className="size-3" />
                  </button>
                ) : null}
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 px-[clamp(0.75rem,2vw,2rem)] py-4">
          <div className="mb-3 flex gap-1.5 overflow-x-auto md:hidden">
            {sidebarFolders.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1 text-xs',
                  filter === item.key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground',
                )}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>

          {newFolderOpen && canCreate ? (
            <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
              <Field name="folderName" label="Folder name" className="min-w-[12rem] flex-1">
                <Input
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  placeholder="e.g. Site photos"
                  maxLength={80}
                  disabled={busy}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addFolder()
                    }
                  }}
                />
              </Field>
              <Button type="button" size="sm" disabled={busy} onClick={addFolder}>
                Create
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setNewFolderOpen(false)
                  setNewFolderName('')
                }}
              >
                Cancel
              </Button>
            </div>
          ) : null}

          {uploadOpen && canCreate ? (
            <div className="relative mb-4 space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Upload a document</h2>
                  <p className="text-xs text-muted-foreground">
                    PDF, JPEG, PNG, or WebP · up to 100 MB · saved to R2 storage
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close upload"
                  onClick={() => setUploadOpen(false)}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
              <label className="relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40">
                <PlusIcon className="size-8 text-primary/80" />
                <span className="text-sm font-medium">
                  {pickedFile ? pickedFile.name : 'Click to browse'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {pickedFile
                    ? `${formatByteSize(pickedFile.size)} · click to choose another`
                    : 'PDF, JPEG, PNG, or WebP'}
                </span>
                <input
                  id="file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                  required
                  disabled={uploadPending}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(event) => {
                    const next = event.target.files?.[0] ?? null
                    setPickedFile(next)
                    setUploadError(null)
                    if (next && !title) setTitle(next.name.replace(/\.[^.]+$/, '').slice(0, 200))
                  }}
                />
              </label>
              <Field name="folderId" label="Folder">
                <select
                  id="folderId"
                  value={uploadFolderId}
                  disabled={uploadPending}
                  onChange={(event) => setUploadFolderId(event.target.value)}
                  className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                >
                  <option value="">Unfiled</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field name="title" label="Title (optional)">
                <Input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Leave blank to use the file name"
                  maxLength={200}
                  disabled={uploadPending}
                />
              </Field>
              {showNotes ? (
                <Field name="notes" label="Notes">
                  <textarea
                    id="notes"
                    rows={3}
                    maxLength={4000}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={uploadPending}
                    className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[72px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                  />
                </Field>
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => setShowNotes(true)}
                >
                  Add notes
                </button>
              )}
              {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
              <div className="flex gap-2">
                <Button type="button" disabled={uploadPending} onClick={() => void submitUpload()}>
                  {uploadPending ? 'Uploading…' : 'Upload'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={uploadPending}
                  onClick={() => setUploadOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <FolderIcon className="mb-3 size-10 text-muted-foreground/50" />
              <p className="text-sm font-medium">No documents here</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {canCreate
                  ? 'Create a folder, then upload contracts, scans, and papers — up to 100 MB each.'
                  : 'Nothing matches this folder or search.'}
              </p>
              {canCreate && !uploadOpen ? (
                <Button type="button" size="sm" className="mt-4 gap-1.5" onClick={() => setUploadOpen(true)}>
                  <UploadIcon className="size-3.5" />
                  Upload
                </Button>
              ) : null}
            </div>
          ) : view === 'grid' ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visible.map((doc) => (
                <li key={doc.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => setPreview(doc)}
                    className="flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition-shadow hover:border-primary/40 hover:shadow-md"
                  >
                    <DocPreview doc={doc} />
                    <div className="border-t border-border px-2.5 py-2">
                      <p className="truncate text-xs font-medium text-foreground" title={doc.title}>
                        {doc.title}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {formatByteSize(doc.byteSize)}
                        {doc.createdByName ? ` · ${doc.createdByName}` : ''}
                      </p>
                    </div>
                  </button>
                  {canDelete ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-sm"
                      disabled={busy}
                      aria-label={`Delete ${doc.title}`}
                      className="absolute top-2 right-2 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => remove(doc.id, doc.title)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="overflow-hidden rounded-lg border border-border bg-card">
              {visible.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-muted/40"
                >
                  <DocTypeIcon contentType={doc.contentType} className="size-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setPreview(doc)}
                      className="truncate text-left text-sm font-medium text-primary hover:underline"
                    >
                      {doc.title}
                    </button>
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.originalName} · {formatByteSize(doc.byteSize)}
                      {doc.createdByName ? ` · ${doc.createdByName}` : ''}
                      {' · '}
                      {formatDateTime(new Date(doc.createdAt), timeZone)}
                    </p>
                  </div>
                  {canUpdate && folders.length > 0 ? (
                    <select
                      aria-label={`Move ${doc.title}`}
                      className="border-input bg-background h-8 max-w-[9rem] rounded-md border px-2 text-xs"
                      value={doc.folderId ?? ''}
                      disabled={busy}
                      onChange={(event) => {
                        const next = event.target.value || null
                        startBusy(async () => {
                          const result = await moveDocument({ id: doc.id, folderId: next })
                          if (result.ok) {
                            toast.success('Moved.')
                            router.refresh()
                          } else {
                            toast.error(result.error.message)
                          }
                        })
                      }}
                    >
                      <option value="">Unfiled</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {canDelete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      aria-label={`Delete ${doc.title}`}
                      onClick={() => remove(doc.id, doc.title)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DocumentPreviewDialog doc={preview} onClose={() => setPreview(null)} />
    </div>
  )
}

function DocumentPreviewDialog({ doc, onClose }: { doc: Doc | null; onClose: () => void }) {
  const open = Boolean(doc)
  const isImage = doc?.contentType.startsWith('image/') ?? false
  const isPdf = doc?.contentType === 'application/pdf'
  const apiSrc = doc ? `/api/documents/${doc.id}` : ''
  const downloadHref = doc ? `/api/documents/${doc.id}?download=1` : ''
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!doc || (!isImage && !isPdf)) {
      setBlobUrl(null)
      setPdfBytes(null)
      setLoadError(null)
      setLoading(false)
      return
    }

    // Very large PDFs: skip in-browser canvas; offer download instead.
    if (isPdf && doc.byteSize > 40 * 1024 * 1024) {
      setBlobUrl(null)
      setPdfBytes(null)
      setLoadError('This PDF is too large to preview in the browser. Download it to open.')
      setLoading(false)
      return
    }

    let revoked: string | null = null
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setBlobUrl(null)
    setPdfBytes(null)

    void (async () => {
      try {
        const res = await fetch(`/api/documents/${doc.id}`, { credentials: 'same-origin' })
        if (!res.ok) throw new Error('Could not open this file.')
        const bytes = await res.arrayBuffer()
        if (cancelled) return
        if (isPdf) {
          setPdfBytes(bytes.slice(0))
        } else {
          const url = URL.createObjectURL(new Blob([bytes], { type: doc.contentType }))
          revoked = url
          setBlobUrl(url)
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not open this file.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [doc, isImage, isPdf])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="xl" className="flex max-h-[90vh] w-[min(96vw,56rem)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="mb-0 flex flex-row items-center gap-2 space-y-0 border-b border-border px-4 py-3 pr-12 text-left">
          <DialogTitle className="min-w-0 flex-1 truncate text-base">{doc?.title ?? 'Document'}</DialogTitle>
          {doc ? (
            <div className="flex shrink-0 items-center gap-1" data-no-drag>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
                <a href={downloadHref}>
                  <DownloadIcon className="size-3.5" />
                  Download
                </a>
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" asChild>
                <a href={apiSrc} target="_blank" rel="noreferrer" aria-label="Open in new tab">
                  <ExternalLinkIcon className="size-3.5" />
                </a>
              </Button>
            </div>
          ) : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-muted/40">
          {!doc ? null : loading ? (
            <div className="flex h-[min(70vh,44rem)] items-center justify-center text-sm text-muted-foreground">
              Opening file…
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <FileTextIcon className="size-10 text-muted-foreground" />
              <p className="text-sm text-destructive">{loadError}</p>
              <Button type="button" size="sm" className="gap-1.5" asChild>
                <a href={downloadHref}>
                  <DownloadIcon className="size-3.5" />
                  Download
                </a>
              </Button>
            </div>
          ) : isImage && blobUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- private blob preview
            <img src={blobUrl} alt={doc.title} className="mx-auto max-h-[min(75vh,48rem)] w-full object-contain p-4" />
          ) : isPdf && pdfBytes ? (
            <PdfCanvasPreview data={pdfBytes} title={doc.title} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <FileTextIcon className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Preview is not available for this file type.</p>
              <Button type="button" size="sm" className="gap-1.5" asChild>
                <a href={downloadHref}>
                  <DownloadIcon className="size-3.5" />
                  Download
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DocTypeIcon({ contentType, className }: { contentType: string; className?: string }) {
  if (contentType.startsWith('image/')) return <FileImageIcon className={className} aria-hidden />
  return <FileTextIcon className={className} aria-hidden />
}

function DocPreview({ doc }: { doc: Doc }) {
  const isImage = doc.contentType.startsWith('image/')
  const isPdf = doc.contentType === 'application/pdf'

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private org file URL
      <img
        src={`/api/documents/${doc.id}`}
        alt=""
        className="aspect-[4/3] w-full object-cover bg-muted"
      />
    )
  }

  return (
    <div
      className={cn(
        'flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-muted/50',
        isPdf && 'bg-primary/8',
      )}
    >
      <DocTypeIcon contentType={doc.contentType} className="size-10 text-primary" />
      <span className="rounded bg-card px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {isPdf ? 'PDF' : doc.contentType.split('/')[1] || 'FILE'}
      </span>
    </div>
  )
}

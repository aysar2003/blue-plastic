'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileIcon, PaperclipIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { attachDocumentFile, removeDocumentFile } from '@/app/(app)/attachments/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type AttachmentRow = {
  id: string
  originalName: string
  contentType: string
  byteSize: number
}

type Target =
  | { kind: 'purchase'; id: string }
  | { kind: 'sale'; id: string }
  | { kind: 'journal'; id: string }

/**
 * Papers kept on a bill, invoice, PO, or journal — the vendor invoice photo,
 * the signed delivery note, the receipt. Same control on every document.
 */
export function DocumentAttachments({
  target,
  files,
  canEdit,
  title = 'Attachments',
  hint = 'PDF or photo · 4 MB or smaller',
}: {
  target: Target
  files: AttachmentRow[]
  canEdit: boolean
  title?: string
  hint?: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()

  function upload(list: FileList | null) {
    if (!list || list.length === 0) return
    const form = new FormData()
    form.set('kind', target.kind)
    form.set('id', target.id)
    for (const file of Array.from(list)) form.append('file', file)
    start(async () => {
      const result = await attachDocumentFile(form)
      if (result.ok) {
        toast.success(
          result.data.count === 1 ? 'File attached.' : `${result.data.count} files attached.`,
        )
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  function remove(fileId: string) {
    start(async () => {
      const result = await removeDocumentFile({ fileId, kind: target.kind, id: target.id })
      if (result.ok) {
        toast.success('Attachment removed.')
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <PaperclipIcon className="size-3.5 text-muted-foreground" aria-hidden />
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        {canEdit ? (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => upload(event.target.files)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              Attach
            </Button>
          </div>
        ) : null}
      </div>

      {files.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No files attached yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {files.map((file) => (
            <li
              key={file.id}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-2',
                pending && 'opacity-70',
              )}
            >
              <a
                href={`/api/files/ledger/${file.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
              >
                <FileIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate font-medium">{file.originalName}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {Math.max(1, Math.round(file.byteSize / 1024))} KB
                </span>
              </a>
              {canEdit ? (
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remove ${file.originalName}`}
                  disabled={pending}
                  onClick={() => remove(file.id)}
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

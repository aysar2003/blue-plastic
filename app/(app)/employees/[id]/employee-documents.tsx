'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteEmployeeDocument, uploadEmployeeDocument } from '../contracts/actions'

type Doc = {
  id: string
  kind: string
  title: string
  originalName: string
  byteSize: number
}

export function EmployeeDocumentsPanel({
  employeeId,
  documents,
  canManage,
}: {
  employeeId: string
  documents: Doc[]
  canManage: boolean
}) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('ID')
  const [file, setFile] = useState<File | null>(null)

  function upload() {
    if (!file) {
      toast.error('Choose a file')
      return
    }
    startBusy(async () => {
      const form = new FormData()
      form.set('employeeId', employeeId)
      form.set('title', title.trim() || file.name)
      form.set('kind', kind)
      form.set('file', file)
      const result = await uploadEmployeeDocument(form)
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Upload failed')
        return
      }
      toast.success('Document saved')
      setTitle('')
      setFile(null)
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!window.confirm('Delete this document?')) return
    startBusy(async () => {
      const result = await deleteEmployeeDocument({ employeeId, id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not delete')
        return
      }
      toast.success('Deleted')
      router.refresh()
    })
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Documents (ID, certificates, papers)
      </h2>
      <p className="text-xs text-muted-foreground">
        Heshiiska saxiixan ee mushaharka waa Contracts tab. Halkan waa waraaqaha kale ee shaqaalaha.
      </p>

      {canManage ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="National ID" />
          </div>
          <div className="space-y-1.5">
            <Label>Kind</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="ID">ID</option>
              <option value="CERTIFICATE">Certificate</option>
              <option value="CONTRACT">Contract scan</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>File (PDF / image, max 8 MB)</Label>
            <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Button type="button" disabled={busy || !file} onClick={upload}>
              {busy ? 'Uploading…' : 'Upload document'}
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {documents.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">No documents yet.</li>
        ) : (
          documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div>
                <a
                  href={`/api/employees/${employeeId}/documents/${doc.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {doc.title}
                </a>
                <div className="text-xs text-muted-foreground">
                  {doc.kind} · {doc.originalName} · {(doc.byteSize / 1024).toFixed(0)} KB
                </div>
              </div>
              {canManage ? (
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => remove(doc.id)}>
                  Delete
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

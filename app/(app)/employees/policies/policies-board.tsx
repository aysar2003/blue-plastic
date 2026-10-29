'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createHrPolicy, deleteHrPolicy, updateHrPolicy, uploadHrPolicyFile } from './actions'

type Policy = {
  id: string
  title: string
  body: string
  published: boolean
  sortOrder: number
  hasFile: boolean
  originalName: string | null
}

export function PoliciesBoard({ policies, canManage }: { policies: Policy[]; canManage: boolean }) {
  const router = useRouter()
  const [busy, startBusy] = useTransition()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  function create() {
    startBusy(async () => {
      const result = await createHrPolicy({
        title: title.trim(),
        body,
        published: false,
        sortOrder: 0,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Could not create')
        return
      }
      toast.success('Policy created')
      setTitle('')
      setBody('')
      router.refresh()
    })
  }

  function togglePublish(row: Policy) {
    startBusy(async () => {
      const result = await updateHrPolicy({
        id: row.id,
        title: row.title,
        body: row.body,
        published: !row.published,
        sortOrder: row.sortOrder,
      })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Update failed')
        return
      }
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!window.confirm('Delete this policy?')) return
    startBusy(async () => {
      const result = await deleteHrPolicy({ id })
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Delete failed')
        return
      }
      toast.success('Deleted')
      router.refresh()
    })
  }

  function upload(id: string, file: File | null) {
    if (!file) return
    startBusy(async () => {
      const form = new FormData()
      form.set('id', id)
      form.set('file', file)
      const result = await uploadHrPolicyFile(form)
      if (!result.ok) {
        toast.error(result.error?.message ?? 'Upload failed')
        return
      }
      toast.success('File saved')
      router.refresh()
    })
  }

  return (
    <div className="grid max-w-3xl gap-6">
      {canManage ? (
        <section className="grid gap-3 rounded-lg border border-border p-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leave policy" />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <textarea
              className="min-h-[6rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div>
            <Button type="button" disabled={busy || !title.trim()} onClick={create}>
              Add policy
            </Button>
          </div>
        </section>
      ) : null}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {policies.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No company HR policies yet.
          </li>
        ) : (
          policies.map((row) => (
            <li key={row.id} className="space-y-2 px-3 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {row.title}
                    {row.published ? (
                      <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">Published</span>
                    ) : (
                      <span className="ml-2 text-xs text-muted-foreground">Draft</span>
                    )}
                  </div>
                  {row.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{row.body.slice(0, 280)}</p>
                  ) : null}
                  {row.hasFile ? (
                    <a
                      href={`/api/employees/policies/${row.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-primary hover:underline"
                    >
                      {row.originalName ?? 'Attachment'}
                    </a>
                  ) : null}
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-1">
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => togglePublish(row)}>
                      {row.published ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => remove(row.id)}>
                      Delete
                    </Button>
                  </div>
                ) : null}
              </div>
              {canManage ? (
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="text-xs"
                  onChange={(e) => upload(row.id, e.target.files?.[0] ?? null)}
                />
              ) : null}
              <div>
                <Link href={`/employees/policies/${row.id}`} className="text-xs text-primary hover:underline">
                  Open →
                </Link>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

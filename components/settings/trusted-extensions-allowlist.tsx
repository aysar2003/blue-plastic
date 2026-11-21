'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { updateTrustedExtensionsAction } from '@/app/(app)/settings/(work)/organization/trusted-extensions-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  mergedTrustedExtensions,
  parseOrgTrustedExtensions,
  TRUSTED_EXTENSIONS,
  type OrgTrustedExtensionEntry,
} from '@/lib/erp/extensions/registry'

const BUILTIN = new Set(TRUSTED_EXTENSIONS.map((row) => row.id))

export function TrustedExtensionsAllowlist({
  trustedExtensions,
  canEdit,
}: {
  trustedExtensions: unknown
  canEdit: boolean
}) {
  const builtIn = mergedTrustedExtensions(null)
  const initialExtras = useMemo(
    () => parseOrgTrustedExtensions(trustedExtensions).filter((row) => !BUILTIN.has(row.id)),
    [trustedExtensions],
  )
  const [extras, setExtras] = useState<OrgTrustedExtensionEntry[]>(initialExtras)
  const [draftId, setDraftId] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [pending, start] = useTransition()

  function addRow() {
    const id = draftId.trim()
    if (!id) {
      toast.error('Enter an extension id.')
      return
    }
    if (BUILTIN.has(id) || extras.some((row) => row.id === id)) {
      toast.error('That id is already on the allowlist.')
      return
    }
    setExtras((rows) => [...rows, { id, title: draftTitle.trim() || id }])
    setDraftId('')
    setDraftTitle('')
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm font-medium">Trusted extensions</p>
      <p className="mt-1 text-sm text-muted-foreground">
        First-party registry plus this organisation&apos;s allowlist. Untrusted plugins stay out.
      </p>

      <ul className="mt-3 space-y-2 text-sm">
        {builtIn.map((row) => (
          <li key={row.id} className="rounded-md border px-3 py-2">
            <p className="font-medium">{row.title}</p>
            <p className="text-muted-foreground">
              {row.id} · v{row.version} · first-party
            </p>
          </li>
        ))}
        {extras.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-2 rounded-md border px-3 py-2">
            <div>
              <p className="font-medium">{row.title ?? row.id}</p>
              <p className="text-muted-foreground">{row.id}</p>
            </div>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setExtras((rows) => rows.filter((item) => item.id !== row.id))}
              >
                Remove
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {canEdit ? (
        <div className="mt-4 grid max-w-md gap-3">
          <div>
            <Label htmlFor="ext-id">Add extension id</Label>
            <Input
              id="ext-id"
              value={draftId}
              disabled={pending}
              onChange={(e) => setDraftId(e.target.value)}
              placeholder="partner.reports"
            />
          </div>
          <div>
            <Label htmlFor="ext-title">Title (optional)</Label>
            <Input
              id="ext-title"
              value={draftTitle}
              disabled={pending}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Partner reports"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={addRow}>
              Add to allowlist
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await updateTrustedExtensionsAction({ entries: extras })
                  if (result.ok) toast.success('Allowlist saved.')
                  else toast.error(result.error ?? 'Could not save.')
                })
              }
            >
              Save allowlist
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

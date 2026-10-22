'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileTextIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { idleState } from '@/components/forms/action-state'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  createCompanyAgreementForm,
  removeCompanyAgreement,
  setCompanyAgreementStatus,
} from './actions'

export type AgreementRow = {
  id: string
  title: string
  status: 'DRAFT' | 'ACTIVE' | 'ENDED'
  startsOn: string | null
  endsOn: string | null
  notes: string | null
  originalName: string | null
  hasFile: boolean
  createdAt: string
}

export function CompanyAgreementsPanel({
  orgId,
  agreements,
}: {
  orgId: string
  agreements: AgreementRow[]
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(createCompanyAgreementForm, idleState)
  const [pending, start] = useTransition()
  const [status, setStatus] = useState('DRAFT')

  useEffect(() => {
    if (state.status === 'success') router.refresh()
  }, [state.status, router])

  const run = (
    fn: () => Promise<{ ok: boolean; error?: { message: string } }>,
    success: string,
  ) => {
    start(async () => {
      const result = await fn()
      if (result.ok) {
        toast.success(success)
        router.refresh()
      } else {
        toast.error(result.error?.message ?? 'That did not work.')
      }
    })
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <FileTextIcon className="size-4 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold">Agreements</h2>
          <p className="text-xs text-muted-foreground">
            Contracts and rent papers for this company. Mark Ended when you leave the
            agreement — then you can delete the company database.
          </p>
        </div>
      </div>

      {agreements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agreements yet.</p>
      ) : (
        <ul className="space-y-3">
          {agreements.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{row.title}</p>
                  <Badge
                    variant={
                      row.status === 'ACTIVE'
                        ? 'success'
                        : row.status === 'ENDED'
                          ? 'warning'
                          : 'secondary'
                    }
                  >
                    {row.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[row.startsOn, row.endsOn].filter(Boolean).join(' → ') || 'No dates'}
                  {row.originalName ? ` · ${row.originalName}` : ''}
                </p>
                {row.notes ? (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{row.notes}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {row.hasFile ? (
                  <a
                    href={`/api/databases/${orgId}/agreements/${row.id}/file`}
                    className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
                  >
                    Download
                  </a>
                ) : null}
                {row.status !== 'ACTIVE' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () =>
                          setCompanyAgreementStatus({
                            orgId,
                            agreementId: row.id,
                            status: 'ACTIVE',
                          }),
                        'Agreement is active.',
                      )
                    }
                  >
                    Activate
                  </Button>
                ) : null}
                {row.status !== 'ENDED' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () =>
                          setCompanyAgreementStatus({
                            orgId,
                            agreementId: row.id,
                            status: 'ENDED',
                          }),
                        'Agreement marked ended.',
                      )
                    }
                  >
                    Mark ended
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Delete agreement “${row.title}”?`)) return
                    run(
                      () => removeCompanyAgreement({ orgId, agreementId: row.id }),
                      'Agreement removed.',
                    )
                  }}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="space-y-3 border-t pt-4">
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="status" value={status} />
        <FormStatus state={state} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="agreement-title">Title</Label>
            <Input id="agreement-title" name="title" required placeholder="Rent 2026" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agreement-status">Status</Label>
            <select
              id="agreement-status"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ENDED">Ended</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agreement-file">File (PDF or image)</Label>
            <Input
              id="agreement-file"
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agreement-starts">Starts</Label>
            <Input id="agreement-starts" name="startsOn" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agreement-ends">Ends</Label>
            <Input id="agreement-ends" name="endsOn" type="date" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="agreement-notes">Notes</Label>
            <textarea
              id="agreement-notes"
              name="notes"
              rows={2}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <SubmitButton>Add agreement</SubmitButton>
      </form>
    </Card>
  )
}

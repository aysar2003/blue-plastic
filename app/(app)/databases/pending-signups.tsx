'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { ModuleFlag } from '@/lib/feature-flags'
import type { SignupRequestRow } from '@/server/services/register.service'

import {
  CompanyAppsPicker,
  hasAnyModuleOn,
  moduleActionFields,
} from './company-apps-picker'
import { reviewSignupRequest } from './actions'

export function PendingSignups({ requests }: { requests: SignupRequestRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftModules, setDraftModules] = useState<Record<ModuleFlag, boolean> | null>(null)

  if (requests.length === 0) return null

  const openApprove = (row: SignupRequestRow) => {
    setEditingId(row.id)
    setDraftModules({ ...row.modules })
  }

  const cancelApprove = () => {
    setEditingId(null)
    setDraftModules(null)
  }

  const reject = (id: string) => {
    startTransition(async () => {
      const result = await reviewSignupRequest({ id, decision: 'reject' })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Request rejected. They cannot sign in.')
      if (editingId === id) cancelApprove()
      router.refresh()
    })
  }

  const approve = (id: string, modules: Record<ModuleFlag, boolean>) => {
    if (!hasAnyModuleOn(modules)) {
      toast.error('Leave at least one app on.')
      return
    }
    startTransition(async () => {
      const result = await reviewSignupRequest({
        id,
        decision: 'approve',
        ...moduleActionFields(modules),
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(
        `${'name' in result.data ? result.data.name : 'Company'} approved — they can sign in now.`,
      )
      cancelApprove()
      router.refresh()
    })
  }

  return (
    <section className="rounded-lg border border-amber-500/40 bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Registration requests</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          People asked to create a company. As system owner, approve and choose which apps they get
          (all, or only some — you can add or remove from what they requested). Reject to deny
          access. They cannot sign in until you approve.
        </p>
      </div>
      <ul className="divide-y divide-border">
        {requests.map((row) => {
          const editing = editingId === row.id && draftModules
          return (
            <li key={row.id} className="space-y-3 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{row.organizationName}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.ownerName} · {row.email} · {row.baseCurrency} · FY starts month{' '}
                    {row.fiscalYearStartMonth}
                  </p>
                  <p className="mt-1 text-xs text-foreground">
                    Requested apps:{' '}
                    <span className="text-muted-foreground">
                      {row.requestedApps.length > 0 ? row.requestedApps.join(', ') : 'None selected'}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                    Requested {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
                {!editing ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => openApprove(row)}
                    >
                      <CheckIcon className="size-3.5" />
                      Review &amp; approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => reject(row.id)}
                    >
                      <XIcon className="size-3.5" />
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>

              {editing ? (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <ChevronDownIcon className="size-3.5" />
                    Choose apps before opening this company
                  </p>
                  <CompanyAppsPicker
                    modules={draftModules}
                    onChange={setDraftModules}
                    disabled={pending}
                    hint="Starts from what they requested. Check to add an app, uncheck to remove it. You can change this later under Limits."
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || !hasAnyModuleOn(draftModules)}
                      onClick={() => approve(row.id, draftModules)}
                    >
                      <CheckIcon className="size-3.5" />
                      Approve with these apps
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={cancelApprove}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

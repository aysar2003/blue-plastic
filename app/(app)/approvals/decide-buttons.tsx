'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'

import { decideApproval } from './actions'

export function ApprovalDecideButtons({
  requestId,
  isOwn,
  isOwnerOrAdmin,
}: {
  requestId: string
  isOwn: boolean
  isOwnerOrAdmin: boolean
}) {
  const [pending, start] = useTransition()
  const blocked = isOwn && !isOwnerOrAdmin

  function run(decision: 'APPROVED' | 'REJECTED') {
    start(async () => {
      const result = await decideApproval({ requestId, decision })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(decision === 'APPROVED' ? 'Approved and posted.' : 'Rejected — returned to draft.')
    })
  }

  return (
    <div className="inline-flex gap-1.5">
      <button
        type="button"
        disabled={pending || blocked}
        title={blocked ? 'You submitted this — another person must approve.' : undefined}
        onClick={() => run('APPROVED')}
        className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run('REJECTED')}
        className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  )
}

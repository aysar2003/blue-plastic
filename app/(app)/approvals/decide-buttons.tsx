'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { decideApproval } from './actions'

export function ApprovalDecideButtons({
  requestId,
  canDecide,
  canReject,
  blockedReason,
}: {
  requestId: string
  canDecide: boolean
  canReject: boolean
  blockedReason: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function run(decision: 'APPROVED' | 'REJECTED') {
    start(async () => {
      const result = await decideApproval({ requestId, decision })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(decision === 'APPROVED' ? 'Approved and posted.' : 'Rejected — returned to draft.')
      router.refresh()
    })
  }

  return (
    <div className="inline-flex gap-1.5">
      <button
        type="button"
        disabled={pending || !canDecide}
        title={!canDecide ? (blockedReason ?? undefined) : undefined}
        onClick={() => run('APPROVED')}
        className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending || !canReject}
        title={!canReject ? (blockedReason ?? undefined) : undefined}
        onClick={() => run('REJECTED')}
        className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  )
}

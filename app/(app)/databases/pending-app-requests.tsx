'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { reviewAppAccessRequest } from '@/app/(app)/databases/actions-app-access'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDateTime } from '@/lib/date'

export type PendingAppRequestRow = {
  id: string
  orgId: string
  orgName: string
  apps: string[]
  note: string | null
  at: string
  who: string
  email: string
}

export function PendingAppRequests({
  requests,
  timeZone,
}: {
  requests: PendingAppRequestRow[]
  timeZone: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  if (requests.length === 0) return null

  function decide(id: string, decision: 'approve' | 'reject') {
    start(async () => {
      const result = await reviewAppAccessRequest({ id, decision })
      if (result.ok) {
        toast.success(
          decision === 'approve'
            ? `Apps granted for ${result.data.orgName}.`
            : `Request refused for ${result.data.orgName}.`,
        )
        router.refresh()
      } else {
        toast.error(result.error.message)
      }
    })
  }

  return (
    <Card className="space-y-3 p-4">
      <div>
        <h2 className="text-sm font-semibold">App requests</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Companies asking for apps beyond what you granted at create / Limits. Approve to open those
          apps on their books; refuse to leave them closed.
        </p>
      </div>
      <ul className="space-y-3">
        {requests.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-background px-3 py-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-foreground">{row.orgName}</p>
              <p className="text-xs text-muted-foreground">
                {row.who} · {row.email} · {formatDateTime(new Date(row.at), timeZone)}
              </p>
              <p className="text-sm text-foreground">{row.apps.join(', ')}</p>
              {row.note ? <p className="text-xs text-muted-foreground">{row.note}</p> : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => decide(row.id, 'approve')}
              >
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => decide(row.id, 'reject')}
              >
                Refuse
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { SignupRequestRow } from '@/server/services/register.service'

import { reviewSignupRequest } from './actions'

export function PendingSignups({ requests }: { requests: SignupRequestRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (requests.length === 0) return null

  const review = (id: string, decision: 'approve' | 'reject') => {
    startTransition(async () => {
      const result = await reviewSignupRequest({ id, decision })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      if (result.data.decision === 'approve') {
        toast.success(
          `${'name' in result.data ? result.data.name : 'Company'} approved — they can sign in now.`,
        )
      } else {
        toast.success('Request rejected. They cannot sign in.')
      }
      router.refresh()
    })
  }

  return (
    <section className="rounded-lg border border-amber-500/40 bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Registration requests</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          People from outside asked to create a company. Approve to open their books; reject to
          deny access. They cannot sign in until you approve.
        </p>
      </div>
      <ul className="divide-y divide-border">
        {requests.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{row.organizationName}</p>
              <p className="text-xs text-muted-foreground">
                {row.ownerName} · {row.email} · {row.baseCurrency} · FY starts month{' '}
                {row.fiscalYearStartMonth}
              </p>
              <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                Requested {new Date(row.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => review(row.id, 'approve')}
              >
                <CheckIcon className="size-3.5" />
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => review(row.id, 'reject')}
              >
                <XIcon className="size-3.5" />
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

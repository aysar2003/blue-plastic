'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { APPROVAL_PACKS } from '@/lib/approval-templates'

import { installApprovalPack } from './actions'

export function ApprovalReadyPacks({ activePackKey }: { activePackKey: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function install(packKey: 'standard' | 'amount-bands') {
    start(async () => {
      const result = await installApprovalPack({ packKey })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Ready-made workflow installed. Catch-all family rules are off.')
      router.refresh()
    })
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {APPROVAL_PACKS.map((pack) => {
        const active = activePackKey === pack.key
        return (
          <div
            key={pack.key}
            className="flex flex-col rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{pack.name}</p>
              {active ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.6875rem] font-medium text-primary">
                  In use
                </span>
              ) : null}
            </div>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{pack.blurb}</p>
            <p className="mt-2 text-[0.6875rem] text-muted-foreground">
              {pack.rules.length} rules · {pack.rules.map((rule) => rule.name).join(', ')}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => install(pack.key as 'standard' | 'amount-bands')}
              className="mt-3 self-start rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? 'Installing…' : active ? 'Re-apply this set' : 'Use this set'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

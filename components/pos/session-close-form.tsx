'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2Icon } from 'lucide-react'

import { closePosSession } from '@/app/(app)/pos/actions'
import { ODOO } from '@/lib/odoo-brand'

export function SessionCloseForm({
  sessionId,
  registerName,
  currency,
}: {
  sessionId: string
  registerName: string
  currency: string
}) {
  const router = useRouter()
  const [closingCash, setClosingCash] = useState('0.00')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await closePosSession({ sessionId, closingCash })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.push('/pos')
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-black/10 bg-[#f8f5f7] p-3">
      <p className="text-xs text-muted-foreground">Close session · {registerName}</p>
      <label className="mt-2 block text-xs text-muted-foreground">
        Closing cash ({currency})
        <input
          value={closingCash}
          onChange={(event) => setClosingCash(event.target.value)}
          inputMode="decimal"
          className="mt-1 w-full rounded-md border bg-white px-2 py-1.5 text-sm outline-none focus:border-[#714B67]"
        />
      </label>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        style={{ background: ODOO.teal }}
      >
        {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
        Close session
      </button>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2Icon } from 'lucide-react'

import { openPosSession } from '@/app/(app)/pos/actions'
import { ODOO } from '@/lib/odoo-brand'

export function SessionOpenForm({
  registerId,
  registerName,
  currency,
}: {
  registerId: string
  registerName: string
  currency: string
}) {
  const router = useRouter()
  const [openingCash, setOpeningCash] = useState('0.00')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await openPosSession({ registerId, openingCash })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.push(`/pos/${registerId}`)
      router.refresh()
    })
  }

  return (
    <div
      className="rounded-xl border border-white/10 p-5"
      style={{ background: ODOO.surface }}
    >
      <h2 className="text-lg font-semibold text-white">Open session · {registerName}</h2>
      <p className="mt-1 text-sm text-white/60">
        Enter the cash in the drawer before the first sale ({currency}).
      </p>
      <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-white/50">
        Opening cash
        <input
          value={openingCash}
          onChange={(event) => setOpeningCash(event.target.value)}
          inputMode="decimal"
          className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#714B67]"
        />
      </label>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: ODOO.purple }}
      >
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        Open register
      </button>
    </div>
  )
}

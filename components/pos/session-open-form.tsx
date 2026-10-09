'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2Icon } from 'lucide-react'

import { openPosSession } from '@/app/(app)/pos/actions'
import { ODOO } from '@/lib/odoo-brand'
import { CASHIER_PIN_MAX, CASHIER_PIN_MESSAGE, isCashierPin } from '@/lib/pos-pin'

export function SessionOpenForm({
  registerId,
  registerName,
  currency,
  hasPin = false,
  beforeSubmit,
}: {
  registerId: string
  registerName: string
  currency: string
  hasPin?: boolean
  beforeSubmit?: () => Promise<unknown>
}) {
  const router = useRouter()
  const [openingCash, setOpeningCash] = useState('0.00')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (hasPin && !isCashierPin(pin.trim())) {
      setError(pin.trim() === '' ? 'Enter the PIN.' : CASHIER_PIN_MESSAGE)
      return
    }
    startTransition(async () => {
      await beforeSubmit?.()
      const result = await openPosSession({
        registerId,
        openingCash,
        ...(hasPin ? { pin } : {}),
      })
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
      {hasPin ? (
        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-white/50">
          Cashier PIN
          <input
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
            minLength={4}
            maxLength={CASHIER_PIN_MAX}
            pattern="[A-Za-z0-9]{4,64}"
            title="Use at least 4 letters or numbers."
            className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#714B67]"
          />
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
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

'use client'

import { useState } from 'react'
import { Loader2Icon } from 'lucide-react'

import { ODOO } from '@/lib/odoo-brand'
import { CASHIER_PIN_MAX } from '@/lib/pos-pin'

/**
 * Asks for the cashier PIN before Open Register or Continue Selling.
 * The value is sent to a server action; it is never stored in the browser.
 */
export function CashierPinPrompt({
  registerName,
  pending,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  registerName: string
  pending: boolean
  error: string | null
  submitLabel: string
  onSubmit: (pin: string) => void
  onCancel?: () => void
}) {
  const [pin, setPin] = useState('')

  return (
    <form
      className="rounded-xl border border-white/10 p-5"
      style={{ background: ODOO.surface }}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(pin)
      }}
    >
      <h2 className="text-lg font-semibold text-white">PIN · {registerName}</h2>
      <p className="mt-1 text-sm text-white/60">
        Enter this cashier&apos;s PIN. Letters or numbers, at least 4 characters.
      </p>
      <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-white/50">
        PIN
        <input
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          autoFocus
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
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: ODOO.purple }}
        >
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="text-sm text-white/50 hover:text-white" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}

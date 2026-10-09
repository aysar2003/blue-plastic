'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { transferPosRegister } from '@/app/(app)/pos/actions'
import { ODOO } from '@/lib/odoo-brand'

export type TransferDestination = { id: string; code: string; name: string }

export function RegisterTransferForm({
  registerId,
  balance,
  balanceRaw,
  currency,
  destinations,
  dark = false,
  onDone,
}: {
  registerId: string
  balance: string
  /** Plain decimal, used to fill the amount box. */
  balanceRaw: string
  currency: string
  destinations: TransferDestination[]
  dark?: boolean
  onDone?: (message: string) => void
}) {
  const router = useRouter()
  const [toAccountId, setToAccountId] = useState(destinations[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const text = dark ? '#f4f4f5' : undefined
  const muted = dark ? 'rgba(255,255,255,0.55)' : undefined
  const field = dark
    ? 'mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none'
    : 'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none'

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        startTransition(async () => {
          const result = await transferPosRegister({
            registerId,
            toAccountId,
            amount: amount.trim(),
            memo: memo.trim(),
          })
          if (!result.ok) {
            setError(result.error.message)
            return
          }
          setAmount('')
          setMemo('')
          onDone?.(`Transferred ${result.data.amount} · ${result.data.number}`)
          router.refresh()
        })
      }}
    >
      <p className="text-sm" style={{ color: muted }}>
        Balance in this register:{' '}
        <span className="font-semibold tabular-nums" style={{ color: text }}>
          {balance}
        </span>
        <span style={{ color: muted }}> {currency}</span>
      </p>
      <p className="text-xs" style={{ color: muted }}>
        The money stays here until you transfer it. Closing the session does not move it.
      </p>
      {destinations.length === 0 ? (
        <p className="text-sm text-red-500">There is no other bank or wallet account to transfer to.</p>
      ) : (
        <>
          <label className="block text-sm" style={{ color: muted }}>
            Transfer to
            <select
              value={toAccountId}
              onChange={(event) => setToAccountId(event.target.value)}
              required
              className={field}
              style={dark ? { background: '#161618', borderColor: 'rgba(255,255,255,0.15)', color: '#fff' } : undefined}
            >
              {destinations.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm" style={{ color: muted }}>
            Amount ({currency})
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              required
              className={field}
              style={dark ? { background: '#161618', borderColor: 'rgba(255,255,255,0.15)', color: '#fff' } : undefined}
            />
          </label>
          <button
            type="button"
            className="text-xs font-medium underline"
            style={{ color: dark ? '#8fd4d7' : ODOO.teal }}
            onClick={() => setAmount(balanceRaw)}
          >
            Use full balance
          </button>
          <label className="block text-sm" style={{ color: muted }}>
            Note
            <input
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              className={field}
              style={dark ? { background: '#161618', borderColor: 'rgba(255,255,255,0.15)', color: '#fff' } : undefined}
            />
          </label>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <button
            type="submit"
            disabled={pending || !toAccountId}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: ODOO.teal }}
          >
            {pending ? 'Transferring…' : 'Transfer out'}
          </button>
        </>
      )}
    </form>
  )
}

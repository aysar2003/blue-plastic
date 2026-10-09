'use client'

import { Loader2Icon } from 'lucide-react'

import { ODOO } from '@/lib/odoo-brand'
import { formatMoney } from '@/lib/money'

export type PosPaymentMethodField = { id: string; name: string; isCash: boolean }

/**
 * The till's Payment dialog body. The sale total sits at the top. Every method
 * starts empty — the parent owns the amounts — and Exact / Remaining fills
 * whatever is still owed into that one field.
 */
export function PosPaymentForm(props: {
  due: number | string
  currency: string
  methods: PosPaymentMethodField[]
  amounts: Record<string, string>
  paid: string
  remaining: string
  change: string
  canValidate: boolean
  pending: boolean
  error: string | null
  dark: boolean
  /** Accounts this till is allowed to hand change back from. */
  changeMethods: { id: string; name: string }[]
  changeMethodId: string
  onChangeMethod: (methodId: string) => void
  /** Extra note shown under the Paid/Remaining/Change summary — e.g. a shortfall discount. */
  note?: React.ReactNode
  onAmount: (method: PosPaymentMethodField, raw: string) => void
  onFill: (methodId: string) => void
  onCancel: () => void
  onValidate: () => void
}) {
  const muted = props.dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'
  const text = props.dark ? '#f3f3f3' : '#1f1f23'
  const border = props.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const chip = props.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
  const change = Number(props.change) > 0

  return (
    <>
      <p className="text-sm" style={{ color: muted }}>
        Amount due
      </p>
      <p className="text-2xl font-semibold tabular">{formatMoney(props.due, props.currency)}</p>
      <ul className="mt-4 space-y-3">
        {props.methods.map((method) => (
          <li key={method.id} className="flex items-center gap-2">
            <label htmlFor={`pay-${method.id}`} className="w-36 shrink-0 text-sm font-medium leading-tight">
              {method.name}
            </label>
            <input
              id={`pay-${method.id}`}
              type="text"
              inputMode="decimal"
              value={props.amounts[method.id] ?? ''}
              onChange={(event) => props.onAmount(method, event.target.value)}
              className="flex-1 rounded-md border px-2 py-1.5 text-sm outline-none"
              style={{ background: chip, borderColor: border, color: text }}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => props.onFill(method.id)}
              className="shrink-0 text-xs"
              style={{ color: ODOO.teal }}
            >
              {method.isCash ? 'Exact' : 'Remaining'}
            </button>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-1 text-sm tabular">
        <div className="flex justify-between gap-3">
          <dt>Paid</dt>
          <dd>{formatMoney(props.paid, props.currency)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Remaining</dt>
          <dd>{formatMoney(props.remaining, props.currency)}</dd>
        </div>
        <div
          className="flex justify-between gap-3 font-semibold"
          style={{ color: change ? ODOO.teal : undefined }}
        >
          <dt>Change</dt>
          <dd>{formatMoney(props.change, props.currency)}</dd>
        </div>
      </dl>
      {props.note ? <div className="mt-2">{props.note}</div> : null}
      <label className="mt-4 block text-sm" htmlFor="pos-change-from">
        <span className="font-medium">Return change from</span>
        <select
          id="pos-change-from"
          value={props.changeMethodId}
          onChange={(event) => props.onChangeMethod(event.target.value)}
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm outline-none"
          style={{ background: chip, borderColor: border, color: text }}
        >
          {props.changeMethods.length === 0 ? <option value="">No account</option> : null}
          {props.changeMethods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </select>
      </label>
      {props.error ? <p className="mt-2 text-sm text-red-400">{props.error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-md border px-4 py-2 text-sm"
          style={{ borderColor: border }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={props.onValidate}
          disabled={props.pending || !props.canValidate || Boolean(props.error)}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: ODOO.purple }}
        >
          {props.pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Validate
        </button>
      </div>
    </>
  )
}

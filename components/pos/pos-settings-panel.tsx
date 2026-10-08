'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { savePosPaymentMethodForm, savePosRegisterForm } from '@/app/(app)/pos/actions'
import { idleState } from '@/components/forms/action-state'
import { ODOO } from '@/lib/odoo-brand'

type Overview = {
  methods: {
    id: string
    name: string
    isActive: boolean
    sortOrder: number
    accountLabel: string
    accountId: string
  }[]
  registers: {
    id: string
    name: string
    isActive: boolean
    storeName: string | null
    customerName: string
    paymentMethodIds: string[]
  }[]
  assetAccounts: { id: string; code: string; name: string }[]
  customers: { id: string; displayName: string }[]
  stores: { id: string; name: string }[]
}

const fieldClass =
  'mt-1 w-full rounded-md border border-white/15 bg-[#161618] px-2.5 py-2 text-sm text-white outline-none focus:border-[#017e84]'
const labelClass = 'block text-sm text-white/70'

export function PosSettingsPanel({ data }: { data: Overview }) {
  const [methodState, methodAction, methodPending] = useActionState(
    savePosPaymentMethodForm,
    idleState,
  )
  const [registerState, registerAction, registerPending] = useActionState(
    savePosRegisterForm,
    idleState,
  )
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null)

  const editingMethod = data.methods.find((method) => method.id === editingMethodId) ?? null

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Configuration</h1>
          <p className="mt-1 text-sm text-white/55">
            Payment methods and registers. Sweep wallets later via{' '}
            <Link href="/banking/transfers/new" className="underline" style={{ color: '#8fd4d7' }}>
              Banking → Transfer
            </Link>
            .
          </p>
        </div>
        <Link href="/pos" className="rounded-md px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white">
          ← Dashboard
        </Link>
      </div>

      <section
        id="payment-methods"
        className="scroll-mt-20 rounded-xl border border-white/10 p-5 shadow-lg"
        style={{ background: ODOO.surface }}
      >
        <h2 className="font-semibold text-white">Payment methods</h2>
        <p className="mt-1 text-sm text-white/50">
          E.g. Edahab, EVC, Cash — each posts to its own asset account. Click Edit to change the
          name or linked account.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {data.methods.map((method) => (
            <li
              key={method.id}
              className="rounded-lg border border-white/10 px-3 py-2.5"
              style={{ background: ODOO.surfaceRaised }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-white">
                    {method.name}
                    {!method.isActive ? (
                      <span className="ml-1 text-white/40">(off)</span>
                    ) : null}
                  </span>
                  <span className="ml-2 text-white/45">{method.accountLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingMethodId((current) => (current === method.id ? null : method.id))
                  }
                  className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-white/80 hover:bg-white/10"
                >
                  {editingMethodId === method.id ? 'Cancel' : 'Edit'}
                </button>
              </div>
            </li>
          ))}
          {data.methods.length === 0 ? (
            <li className="text-white/45">No methods yet — add one below.</li>
          ) : null}
        </ul>

        {editingMethod ? (
          <form
            key={editingMethod.id}
            action={methodAction}
            className="mt-4 grid gap-3 rounded-lg border border-white/15 p-4 sm:grid-cols-2"
            style={{ background: '#161618' }}
          >
            <input type="hidden" name="id" value={editingMethod.id} />
            <p className="text-sm font-medium sm:col-span-2" style={{ color: '#c9a9c0' }}>
              Edit · {editingMethod.name}
            </p>
            {methodState.status !== 'idle' && methodState.message ? (
              <p
                className={
                  methodState.status === 'success'
                    ? 'text-sm sm:col-span-2'
                    : 'text-sm sm:col-span-2'
                }
                style={{
                  color: methodState.status === 'success' ? '#8fd4d7' : ODOO.danger,
                }}
              >
                {methodState.message}
              </p>
            ) : null}
            <label className={labelClass}>
              Name
              <input
                name="name"
                required
                defaultValue={editingMethod.name}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Ledger account
              <select
                name="ledgerAccountId"
                required
                defaultValue={editingMethod.accountId}
                className={fieldClass}
              >
                <option value="">Choose account…</option>
                {data.assetAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Sort order
              <input
                name="sortOrder"
                type="number"
                defaultValue={editingMethod.sortOrder}
                className={fieldClass}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70 sm:self-end">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                defaultChecked={editingMethod.isActive}
                className="size-4 rounded border-white/20"
              />
              Active
            </label>
            <button
              type="submit"
              disabled={methodPending}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white sm:col-span-2 disabled:opacity-50"
              style={{ background: ODOO.purple }}
            >
              {methodPending ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        ) : null}

        <form
          action={methodAction}
          className="mt-6 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-2"
        >
          <p className="text-sm font-medium sm:col-span-2" style={{ color: '#c9a9c0' }}>
            Add payment method
          </p>
          {methodState.status !== 'idle' && methodState.message && !editingMethod ? (
            <p
              className="text-sm sm:col-span-2"
              style={{
                color: methodState.status === 'success' ? '#8fd4d7' : ODOO.danger,
              }}
            >
              {methodState.message}
            </p>
          ) : null}
          <label className={labelClass}>
            Name
            <input name="name" required className={fieldClass} />
          </label>
          <label className={labelClass}>
            Ledger account
            <select name="ledgerAccountId" required className={fieldClass}>
              <option value="">Choose account…</option>
              {data.assetAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Sort order
            <input name="sortOrder" type="number" defaultValue={0} className={fieldClass} />
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70 sm:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked
              value="true"
              className="size-4 rounded border-white/20"
            />
            Active
          </label>
          <button
            type="submit"
            disabled={methodPending}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white sm:col-span-2 disabled:opacity-50"
            style={{ background: ODOO.purple }}
          >
            Add payment method
          </button>
        </form>
      </section>

      <section
        id="registers"
        className="scroll-mt-20 rounded-xl border border-white/10 p-5 shadow-lg"
        style={{ background: ODOO.surface }}
      >
        <h2 className="font-semibold text-white">Registers (tills)</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {data.registers.map((register) => (
            <li
              key={register.id}
              className="rounded-lg border border-white/10 px-3 py-2.5"
              style={{ background: ODOO.surfaceRaised }}
            >
              <Link
                href={`/pos/${register.id}`}
                className="font-medium hover:underline"
                style={{ color: '#8fd4d7' }}
              >
                {register.name}
              </Link>
              <span className="text-white/45">
                {' '}
                · {register.customerName}
                {register.storeName ? ` · ${register.storeName}` : ''}
              </span>
            </li>
          ))}
        </ul>

        <form action={registerAction} className="mt-6 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-2">
          {registerState.status !== 'idle' && registerState.message ? (
            <p
              className="text-sm sm:col-span-2"
              style={{
                color: registerState.status === 'success' ? '#8fd4d7' : ODOO.danger,
              }}
            >
              {registerState.message}
            </p>
          ) : null}
          <label className={`${labelClass} sm:col-span-2`}>
            Register name
            <input name="name" required className={fieldClass} />
          </label>
          <label className={labelClass}>
            Default customer (walk-in)
            <select name="defaultCustomerId" required className={fieldClass}>
              <option value="">Choose…</option>
              {data.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Store (stock)
            <select name="storeId" className={fieldClass}>
              <option value="">Office default</option>
              {data.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-white/80">Payment methods on this till</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {data.methods
                .filter((method) => method.isActive)
                .map((method) => (
                  <label key={method.id} className="flex items-center gap-2 text-sm text-white/75">
                    <input
                      type="checkbox"
                      name="paymentMethodIds"
                      value={method.id}
                      className="size-4 rounded border-white/20"
                    />
                    {method.name}
                  </label>
                ))}
            </div>
          </fieldset>
          <button
            type="submit"
            disabled={registerPending}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white sm:col-span-2 disabled:opacity-50"
            style={{ background: ODOO.teal }}
          >
            Add register
          </button>
        </form>
      </section>
    </div>
  )
}

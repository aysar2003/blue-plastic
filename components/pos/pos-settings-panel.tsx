'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { savePosPaymentMethodForm, savePosRegisterForm } from '@/app/(app)/pos/actions'
import { idleState } from '@/components/forms/action-state'

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

export function PosSettingsPanel({ data }: { data: Overview }) {
  const [methodState, methodAction, methodPending] = useActionState(
    savePosPaymentMethodForm,
    idleState,
  )
  const [registerState, registerAction, registerPending] = useActionState(
    savePosRegisterForm,
    idleState,
  )

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#714B67]">POS settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hababka lacag bixinta iyo akoonada ledger-ka. Kadib waxaad lacag u wareejin kartaa{' '}
            <Link href="/banking/transfers/new" className="text-[#017e84] underline">
              Banking → Transfer
            </Link>
            .
          </p>
        </div>
        <Link href="/pos" className="text-sm text-[#714B67] hover:underline">
          ← Back to tills
        </Link>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Payment methods</h2>
        <p className="text-sm text-muted-foreground">
          Tusaale: Edahab, EVC, Premier, My Cash — mid kasta xisaab asset ah.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {data.methods.map((method) => (
            <li key={method.id} className="flex justify-between rounded-md bg-muted/40 px-3 py-2">
              <span>
                {method.name}
                {!method.isActive ? ' (off)' : ''}
              </span>
              <span className="text-muted-foreground">{method.accountLabel}</span>
            </li>
          ))}
          {data.methods.length === 0 ? (
            <li className="text-muted-foreground">No methods yet — add one below.</li>
          ) : null}
        </ul>

        <form action={methodAction} className="mt-6 grid gap-3 sm:grid-cols-2">
          {methodState.status !== 'idle' && methodState.message ? (
            <p
              className={
                methodState.status === 'success'
                  ? 'text-sm text-[#017e84] sm:col-span-2'
                  : 'text-sm text-destructive sm:col-span-2'
              }
            >
              {methodState.message}
            </p>
          ) : null}
          <label className="block text-sm">
            Name
            <input name="name" required className="mt-1 w-full rounded-md border px-2 py-1.5" />
          </label>
          <label className="block text-sm">
            Ledger account
            <select name="ledgerAccountId" required className="mt-1 w-full rounded-md border px-2 py-1.5">
              <option value="">Choose account…</option>
              {data.assetAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Sort order
            <input
              name="sortOrder"
              type="number"
              defaultValue={0}
              className="mt-1 w-full rounded-md border px-2 py-1.5"
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="isActive" defaultChecked value="true" />
            Active
          </label>
          <button
            type="submit"
            disabled={methodPending}
            className="rounded-md bg-[#714B67] px-4 py-2 text-sm font-medium text-white sm:col-span-2"
          >
            Add payment method
          </button>
        </form>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Registers (tills)</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {data.registers.map((register) => (
            <li key={register.id} className="rounded-md bg-muted/40 px-3 py-2">
              <Link href={`/pos/${register.id}`} className="font-medium text-[#017e84] hover:underline">
                {register.name}
              </Link>
              <span className="text-muted-foreground">
                {' '}
                · {register.customerName}
                {register.storeName ? ` · ${register.storeName}` : ''}
              </span>
            </li>
          ))}
        </ul>

        <form action={registerAction} className="mt-6 grid gap-3 sm:grid-cols-2">
          {registerState.status !== 'idle' && registerState.message ? (
            <p
              className={
                registerState.status === 'success'
                  ? 'text-sm text-[#017e84] sm:col-span-2'
                  : 'text-sm text-destructive sm:col-span-2'
              }
            >
              {registerState.message}
            </p>
          ) : null}
          <label className="block text-sm sm:col-span-2">
            Register name
            <input name="name" required className="mt-1 w-full rounded-md border px-2 py-1.5" />
          </label>
          <label className="block text-sm">
            Default customer (walk-in)
            <select name="defaultCustomerId" required className="mt-1 w-full rounded-md border px-2 py-1.5">
              <option value="">Choose…</option>
              {data.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Store (stock)
            <select name="storeId" className="mt-1 w-full rounded-md border px-2 py-1.5">
              <option value="">Office default</option>
              {data.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium">Payment methods on this till</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {data.methods
                .filter((method) => method.isActive)
                .map((method) => (
                  <label key={method.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="paymentMethodIds" value={method.id} />
                    {method.name}
                  </label>
                ))}
            </div>
          </fieldset>
          <button
            type="submit"
            disabled={registerPending}
            className="rounded-md bg-[#017e84] px-4 py-2 text-sm font-medium text-white sm:col-span-2"
          >
            Add register
          </button>
        </form>
      </section>
    </div>
  )
}

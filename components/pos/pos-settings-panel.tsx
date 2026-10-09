'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { savePosPaymentMethodForm, savePosRegisterForm } from '@/app/(app)/pos/actions'
import { PageHeader } from '@/components/data/page-header'
import { idleState } from '@/components/forms/action-state'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { isCashMethodName } from '@/lib/pos-payment'
import { ODOO } from '@/lib/odoo-brand'
import { cn } from '@/lib/utils'

type Overview = {
  methods: {
    id: string
    name: string
    isActive: boolean
    sortOrder: number
    allowsChangeReturn: boolean
    accountLabel: string
    accountId: string
  }[]
  registers: {
    id: string
    name: string
    isActive: boolean
    hasPin: boolean
    storeId: string | null
    storeName: string | null
    defaultCustomerId: string
    customerName: string
    paymentMethodIds: string[]
    staffUserIds: string[]
    accountLabel: string | null
    changeMethodIds: string[]
    defaultChangeMethodId: string | null
    allowWalletChangeReturn: boolean
  }[]
  assetAccounts: { id: string; code: string; name: string }[]
  customers: { id: string; displayName: string }[]
  staff: { id: string; name: string; email: string }[]
  stores: { id: string; name: string }[]
}

const fieldClass =
  'mt-1 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:border-ring'
const labelClass = 'block text-sm text-muted-foreground'

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
  const [editingRegisterId, setEditingRegisterId] = useState<string | null>(null)

  const editingMethod = data.methods.find((method) => method.id === editingMethodId) ?? null
  const editingRegister =
    data.registers.find((register) => register.id === editingRegisterId) ?? null

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-2">
      <PageHeader
        title="Configuration"
        description="Payment methods, counters, and staff. Sales post to each till’s bank account under POS Banks and stay there until someone transfers them out."
        actions={
          <Link href="/pos" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            ← Dashboard
          </Link>
        }
      />
      <p className="-mt-2 text-sm text-muted-foreground">
        Transfer a till’s balance from the register. Other account movements stay in{' '}
        <Link href="/banking/transfers/new" className="font-medium text-primary underline">
          Banking → Transfer
        </Link>
        .
      </p>

      <Card id="payment-methods" className="scroll-mt-20">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold text-foreground">Payment methods</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              E.g. Edahab, EVC, Cash. The orders report totals by these wallets. The money itself
              posts to the till’s bank account. Click Edit to change the name or linked account.
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            {data.methods.map((method) => (
              <li
                key={method.id}
                className="rounded-lg border border-border bg-muted/40 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-foreground">
                      {method.name}
                      {!method.isActive ? (
                        <span className="ml-1 text-muted-foreground">(off)</span>
                      ) : null}
                    </span>
                    <span className="ml-2 text-muted-foreground">{method.accountLabel}</span>
                    {method.allowsChangeReturn ? (
                      <span className="ml-2 text-muted-foreground">· change</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingMethodId((current) => (current === method.id ? null : method.id))
                    }
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    {editingMethodId === method.id ? 'Cancel' : 'Edit'}
                  </button>
                </div>
              </li>
            ))}
            {data.methods.length === 0 ? (
              <li className="text-muted-foreground">No methods yet — add one below.</li>
            ) : null}
          </ul>

          {editingMethod ? (
            <form
              key={editingMethod.id}
              action={methodAction}
              className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-2"
            >
              <input type="hidden" name="id" value={editingMethod.id} />
              <p className="text-sm font-medium text-foreground sm:col-span-2">
                Edit · {editingMethod.name}
              </p>
              {methodState.status !== 'idle' && methodState.message ? (
                <p
                  className="text-sm sm:col-span-2"
                  style={{
                    color: methodState.status === 'success' ? ODOO.teal : ODOO.danger,
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
              <label className="flex items-center gap-2 text-sm text-muted-foreground sm:self-end">
                <input
                  type="checkbox"
                  name="isActive"
                  value="true"
                  defaultChecked={editingMethod.isActive}
                  className="size-4 rounded border-input"
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
                <input
                  type="checkbox"
                  name="allowsChangeReturn"
                  value="true"
                  defaultChecked={editingMethod.allowsChangeReturn}
                  className="size-4 rounded border-input"
                />
                Allow change return from this account
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
            className="grid gap-3 border-t border-border pt-6 sm:grid-cols-2"
          >
            <p className="text-sm font-medium text-foreground sm:col-span-2">Add payment method</p>
            {methodState.status !== 'idle' && methodState.message && !editingMethod ? (
              <p
                className="text-sm sm:col-span-2"
                style={{
                  color: methodState.status === 'success' ? ODOO.teal : ODOO.danger,
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
            <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked
                value="true"
                className="size-4 rounded border-input"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
              <input
                type="checkbox"
                name="allowsChangeReturn"
                defaultChecked
                value="true"
                className="size-4 rounded border-input"
              />
              Allow change return from this account
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
        </CardContent>
      </Card>

      <Card id="registers" className="scroll-mt-20">
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold text-foreground">Counters</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Counter name prints on every 80mm / 58mm receipt. Assign staff, payment accounts,
              cashier PIN, and change-return settings.
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            {data.registers.map((register) => {
              const methodLabels = register.paymentMethodIds
                .map((id) => data.methods.find((method) => method.id === id))
                .filter(Boolean)
                .map((method) => `${method!.name} → ${method!.accountLabel}`)
              const staffLabels = register.staffUserIds
                .map((id) => data.staff.find((person) => person.id === id)?.name)
                .filter(Boolean)
              return (
                <li
                  key={register.id}
                  data-register-row={register.id}
                  className="rounded-lg border border-border bg-muted/40 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/pos/${register.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {register.name}
                      </Link>
                      {!register.isActive ? (
                        <span className="ml-1 text-muted-foreground">(off)</span>
                      ) : null}
                      <p className="mt-0.5 text-muted-foreground">
                        {register.customerName}
                        {register.storeName ? ` · ${register.storeName}` : ''}
                      </p>
                      {register.accountLabel ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{register.accountLabel}</p>
                      ) : null}
                      {methodLabels.length > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Accounts: {methodLabels.join(' · ')}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Staff:{' '}
                        {staffLabels.length > 0 ? staffLabels.join(', ') : 'Anyone with POS access'}
                      </p>
                      {register.hasPin ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">PIN set</p>
                      ) : (
                        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-200/90">
                          No PIN yet — anyone who can sell can use this cashier until an admin sets
                          a PIN.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingRegisterId((current) =>
                          current === register.id ? null : register.id,
                        )
                      }
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      {editingRegisterId === register.id ? 'Cancel' : 'Edit'}
                    </button>
                  </div>
                </li>
              )
            })}
            {data.registers.length === 0 ? (
              <li className="text-muted-foreground">No counters yet — add one below.</li>
            ) : null}
          </ul>

          {editingRegister ? (
            <form
              key={editingRegister.id}
              action={registerAction}
              data-register-edit={editingRegister.id}
              className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-2"
            >
              <input type="hidden" name="id" value={editingRegister.id} />
              <p className="text-sm font-medium text-foreground sm:col-span-2">
                Edit · {editingRegister.name}
              </p>
              <FormMessage state={registerState} />
              <RegisterFields data={data} register={editingRegister} />
              <button
                type="submit"
                disabled={registerPending}
                className="rounded-md px-4 py-2 text-sm font-semibold text-white sm:col-span-2 disabled:opacity-50"
                style={{ background: ODOO.teal }}
              >
                {registerPending ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          ) : null}

          <form
            action={registerAction}
            className="grid gap-3 border-t border-border pt-6 sm:grid-cols-2"
          >
            <p className="text-sm font-medium text-foreground sm:col-span-2">Add counter</p>
            {!editingRegister ? <FormMessage state={registerState} /> : null}
            <RegisterFields data={data} register={null} />
            <button
              type="submit"
              disabled={registerPending}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white sm:col-span-2 disabled:opacity-50"
              style={{ background: ODOO.teal }}
            >
              Add counter
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function FormMessage({
  state,
}: {
  state: { status: string; message?: string | null; fieldErrors?: Record<string, string[]> }
}) {
  const fieldText = state.fieldErrors
    ? [...new Set(Object.values(state.fieldErrors).flat())].join(' ')
    : ''
  const message = state.message || fieldText
  if (state.status === 'idle' || !message) return null
  return (
    <p
      role="status"
      className={cn(
        'text-sm sm:col-span-2',
        state.status === 'success' ? 'text-foreground' : 'text-destructive',
      )}
      style={state.status === 'success' ? { color: ODOO.teal } : undefined}
    >
      {message}
    </p>
  )
}

/** Shared fields for the Add and Edit counter forms. `register` pre-fills Edit. */
function RegisterFields({
  data,
  register,
}: {
  data: Overview
  register: Overview['registers'][number] | null
}) {
  const linked = new Set(register?.paymentMethodIds ?? [])
  const linkedStaff = new Set(register?.staffUserIds ?? [])
  // Active methods can be picked; a method that was switched off stays visible
  // (disabled) on a till that still lists it, so saving visibly drops it.
  const methods = data.methods.filter((method) => method.isActive || linked.has(method.id))
  const hasOffMethod = methods.some((method) => !method.isActive)
  const [onTill, setOnTill] = useState<string[]>(() =>
    methods.filter((method) => method.isActive && linked.has(method.id)).map((method) => method.id),
  )
  const [changeIds, setChangeIds] = useState<string[]>(() => register?.changeMethodIds ?? [])
  const [defaultChangeId, setDefaultChangeId] = useState(register?.defaultChangeMethodId ?? '')
  const [walletChange, setWalletChange] = useState(register?.allowWalletChangeReturn ?? true)

  function toggleTill(id: string, checked: boolean) {
    setOnTill((current) => {
      const next = checked ? [...new Set([...current, id])] : current.filter((value) => value !== id)
      return next
    })
    if (checked) {
      const method = methods.find((row) => row.id === id)
      if (method?.allowsChangeReturn) {
        setChangeIds((current) => (current.includes(id) ? current : [...current, id]))
      }
    } else {
      setChangeIds((current) => current.filter((value) => value !== id))
      setDefaultChangeId((current) => (current === id ? '' : current))
    }
  }

  const tillMethods = methods.filter((method) => onTill.includes(method.id) && method.isActive)
  const changeOptions = tillMethods.filter(
    (method) =>
      method.allowsChangeReturn &&
      changeIds.includes(method.id) &&
      (walletChange || isCashMethodName(method.name)),
  )

  return (
    <>
      <input type="hidden" name="changeReturnConfigured" value="true" />
      <label className={`${labelClass} sm:col-span-2`}>
        Counter name
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={register?.name ?? ''}
          placeholder="e.g. Counter 1"
          className={fieldClass}
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Printed on every sales receipt (80mm / 58mm).
        </span>
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Cashier PIN
        <input
          name="pin"
          type="password"
          autoComplete="new-password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          minLength={4}
          maxLength={64}
          pattern="[A-Za-z0-9]{4,64}"
          title="Use at least 4 letters or numbers."
          className={fieldClass}
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          {register
            ? register.hasPin
              ? 'Leave blank to keep the current PIN. Enter a new one — at least 4 letters or numbers — to replace it.'
              : 'No PIN yet. Anyone can sell as this cashier until you set one (at least 4 letters or numbers).'
            : 'Optional. At least 4 letters or numbers. Leave blank and this till opens without a PIN.'}
        </span>
      </label>
      <label className={labelClass}>
        Default customer (walk-in)
        <select
          name="defaultCustomerId"
          required
          defaultValue={register?.defaultCustomerId ?? ''}
          className={fieldClass}
        >
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
        <select name="storeId" defaultValue={register?.storeId ?? ''} className={fieldClass}>
          <option value="">Office default</option>
          {data.stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-foreground">
          Accounts this counter works with
        </legend>
        <p className="mt-1 text-xs text-muted-foreground">
          Each payment method posts to its ledger account — that account prints on the receipt.
        </p>
        <div className="mt-2 space-y-2">
          {methods.map((method) => (
            <label
              key={method.id}
              className={cn(
                'flex items-start gap-2 text-sm',
                method.isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <input
                type="checkbox"
                name="paymentMethodIds"
                value={method.id}
                disabled={!method.isActive}
                checked={method.isActive && onTill.includes(method.id)}
                onChange={(event) => toggleTill(method.id, event.target.checked)}
                className="mt-0.5 size-4 rounded border-input"
              />
              <span>
                <span className="font-medium">
                  {method.name}
                  {!method.isActive ? ' (off)' : ''}
                </span>
                <span className="block text-xs text-muted-foreground">{method.accountLabel}</span>
              </span>
            </label>
          ))}
        </div>
        {hasOffMethod ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Methods marked (off) are switched off and will be removed from this counter when you
            save.
          </p>
        ) : null}
      </fieldset>
      <fieldset className="sm:col-span-2 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium text-foreground">Change</legend>
        <p className="text-xs text-muted-foreground">
          Which accounts may hand change back, which one the Payment dialog opens on, and whether a
          wallet can do it.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="allowWalletChangeReturn"
            value="true"
            checked={walletChange}
            onChange={(event) => {
              const next = event.target.checked
              setWalletChange(next)
              if (!next) {
                setDefaultChangeId((current) => {
                  const method = methods.find((row) => row.id === current)
                  return method && !isCashMethodName(method.name) ? '' : current
                })
              }
            }}
            className="size-4 rounded border-input"
          />
          Allow change return from wallets
        </label>
        <div className="mt-3 flex flex-wrap gap-3">
          {tillMethods.map((method) => (
            <label
              key={method.id}
              className={cn(
                'flex items-center gap-2 text-sm',
                method.allowsChangeReturn ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <input
                type="checkbox"
                name="changeMethodIds"
                value={method.id}
                disabled={!method.allowsChangeReturn}
                checked={method.allowsChangeReturn && changeIds.includes(method.id)}
                onChange={(event) => {
                  setChangeIds((current) =>
                    event.target.checked
                      ? [...new Set([...current, method.id])]
                      : current.filter((id) => id !== method.id),
                  )
                  if (!event.target.checked) {
                    setDefaultChangeId((current) => (current === method.id ? '' : current))
                  }
                }}
                className="size-4 rounded border-input"
              />
              {method.name}
              {!method.allowsChangeReturn ? ' (off on the method)' : ''}
            </label>
          ))}
          {tillMethods.length === 0 ? (
            <p className="text-xs text-muted-foreground">Pick the counter&apos;s payment methods first.</p>
          ) : null}
        </div>
        <label className={`${labelClass} mt-3`}>
          Default change-return account
          <select
            name="defaultChangeMethodId"
            value={changeOptions.some((method) => method.id === defaultChangeId) ? defaultChangeId : ''}
            onChange={(event) => setDefaultChangeId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Cash, if this till has it</option>
            {changeOptions.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-foreground">Staff on this counter</legend>
        <p className="mt-1 text-xs text-muted-foreground">
          Leave empty to let anyone with POS access open this counter. When people are selected,
          only they may open a session here.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          {data.staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active users yet.</p>
          ) : (
            data.staff.map((person) => (
              <label
                key={person.id}
                className="flex items-center gap-2 text-sm text-foreground"
                title={person.email}
              >
                <input
                  type="checkbox"
                  name="staffUserIds"
                  value={person.id}
                  defaultChecked={linkedStaff.has(person.id)}
                  className="size-4 rounded border-input"
                />
                {person.name}
              </label>
            ))
          )}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
        <input
          type="checkbox"
          name="isActive"
          value="true"
          defaultChecked={register?.isActive ?? true}
          className="size-4 rounded border-input"
        />
        Active (shows on the POS dashboard)
      </label>
    </>
  )
}

'use client'

import { useActionState, useMemo, useState } from 'react'

import { idleState } from '@/components/forms/action-state'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  RENT_METHOD_LABELS,
  RENT_STATUS_LABELS,
} from '@/lib/platform-billing-labels'
import { formatMoney } from '@/lib/money'
import { rentPaymentMethods } from '@/lib/validation/platform-billing'
import { cn } from '@/lib/utils'

import { submitRentPaymentForm } from './actions'

type Plan = {
  id: string
  name: string
  months: number
  price: string
  currency: string
  maxUsers: number | null
}

type Settings = {
  evcNumber: string | null
  zaadNumber: string | null
  edahabNumber: string | null
  bankName: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  instructions: string | null
}

type Payment = {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
  method: keyof typeof RENT_METHOD_LABELS
  amount: string
  currency: string
  reference: string
  planName: string
  planMonths: number
  reviewNote: string | null
  createdAt: string
  hasReceipt: boolean
}

type Company = {
  name: string
  onTrial: boolean
  rentExpired: boolean
  daysLeft: number | null
  rentExpiresAt: string | null
  rentNote: string | null
  maxUsers: number | null
  balanceLabel?: string
}

export function BillingClient({
  company,
  plans,
  settings,
  payments,
  canSubmit,
}: {
  company: Company
  plans: Plan[]
  settings: Settings
  payments: Payment[]
  canSubmit: boolean
}) {
  const [state, formAction] = useActionState(submitRentPaymentForm, idleState)
  const [planId, setPlanId] = useState(plans[0]?.id ?? '')
  const selected = useMemo(() => plans.find((p) => p.id === planId) ?? plans[0], [plans, planId])
  const hasPending = payments.some((p) => p.status === 'PENDING')

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Rent status</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Company</dt>
            <dd className="font-medium text-foreground">{company.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium text-foreground">
              {company.rentExpired
                ? 'Rent ended'
                : company.onTrial
                  ? `Free trial${company.daysLeft != null ? ` · ${company.daysLeft}d left` : ''}`
                  : company.rentNote ?? 'Paid rent'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ends</dt>
            <dd className="tabular font-medium text-foreground">
              {company.rentExpiresAt
                ? new Date(company.rentExpiresAt).toLocaleDateString()
                : 'No end date'}
            </dd>
          </div>
        </dl>
        {company.maxUsers != null ? (
          <p className="mt-3 text-xs text-muted-foreground">Seat cap: {company.maxUsers} users</p>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">How to pay</h2>
          {settings.instructions ? (
            <p className="mt-2 text-sm text-muted-foreground">{settings.instructions}</p>
          ) : null}
          <ul className="mt-4 space-y-2 text-sm">
            {settings.evcNumber ? (
              <li>
                <span className="font-medium text-foreground">EVC:</span>{' '}
                <span className="tabular">{settings.evcNumber}</span>
              </li>
            ) : null}
            {settings.zaadNumber ? (
              <li>
                <span className="font-medium text-foreground">Zaad:</span>{' '}
                <span className="tabular">{settings.zaadNumber}</span>
              </li>
            ) : null}
            {settings.edahabNumber ? (
              <li>
                <span className="font-medium text-foreground">eDahab:</span>{' '}
                <span className="tabular">{settings.edahabNumber}</span>
              </li>
            ) : null}
            {settings.bankAccountNumber ? (
              <li>
                <span className="font-medium text-foreground">Bank:</span>{' '}
                {[settings.bankName, settings.bankAccountName, settings.bankAccountNumber]
                  .filter(Boolean)
                  .join(' · ')}
              </li>
            ) : null}
            {!settings.evcNumber &&
            !settings.zaadNumber &&
            !settings.edahabNumber &&
            !settings.bankAccountNumber ? (
              <li className="text-muted-foreground">
                Payment numbers are not set yet. Ask the system owner, or submit a reference after
                you agree the amount.
              </li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Submit payment proof</h2>
          {!canSubmit ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Only a company owner or admin can submit rent payments.
            </p>
          ) : hasPending ? (
            <p className="mt-2 text-sm text-muted-foreground">
              You already have a payment waiting for review. You can submit another after it is
              confirmed or rejected.
            </p>
          ) : plans.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No rent plans are available yet. Ask the system owner to publish plans.
            </p>
          ) : (
            <form action={formAction} className="mt-3 space-y-3">
              <FormStatus state={state} />
              <div className="space-y-1.5">
                <Label htmlFor="planId">Plan</Label>
                <select
                  id="planId"
                  name="planId"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  required
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} · {plan.months} mo ·{' '}
                      {formatMoney(plan.price, plan.currency)}
                      {plan.maxUsers != null ? ` · ${plan.maxUsers} seats` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {selected ? (
                <p className="text-xs text-muted-foreground">
                  Pay {formatMoney(selected.price, selected.currency)} for {selected.months} month
                  {selected.months === 1 ? '' : 's'}
                  {selected.maxUsers != null ? ` · up to ${selected.maxUsers} users` : ''}.
                </p>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="method">Paid with</Label>
                <select
                  id="method"
                  name="method"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  required
                  defaultValue="EVC"
                >
                  {rentPaymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {RENT_METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount paid</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  defaultValue={selected?.price ?? ''}
                />
                {state.fieldErrors?.amount?.[0] ? (
                  <p className="text-xs text-destructive">{state.fieldErrors.amount[0]}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reference">Transaction reference</Label>
                <Input id="reference" name="reference" required placeholder="e.g. SMS / bank ref" />
                {state.fieldErrors?.reference?.[0] ? (
                  <p className="text-xs text-destructive">{state.fieldErrors.reference[0]}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input id="notes" name="notes" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receipt">Receipt screenshot (optional)</Label>
                <Input id="receipt" name="receipt" type="file" accept="image/*,application/pdf" />
              </div>
              <SubmitButton>Submit for confirmation</SubmitButton>
            </form>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Payment history</h2>
        </div>
        {payments.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {payments.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {row.planName} · {formatMoney(row.amount, row.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {RENT_METHOD_LABELS[row.method]} · {row.reference} ·{' '}
                    {new Date(row.createdAt).toLocaleString()}
                    {row.hasReceipt ? ' · receipt attached' : ''}
                  </p>
                  {row.reviewNote ? (
                    <p className="mt-1 text-xs text-muted-foreground">Note: {row.reviewNote}</p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wide',
                    row.status === 'CONFIRMED' && 'text-emerald-700 dark:text-emerald-400',
                    row.status === 'PENDING' && 'text-amber-700 dark:text-amber-400',
                    row.status === 'REJECTED' && 'text-destructive',
                  )}
                >
                  {RENT_STATUS_LABELS[row.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

'use client'

import { useActionState, useMemo, useState } from 'react'

import { idleState } from '@/components/forms/action-state'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  RENT_METHOD_LABELS,
  RENT_STATUS_LABELS,
} from '@/lib/platform-billing-labels'
import { formatMoney } from '@/lib/money'
import { rentPaymentMethods, type RentPaymentMethodInput } from '@/lib/validation/platform-billing'
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
}

function subscriptionStatus(company: Company, hasPending: boolean) {
  if (hasPending) return { label: 'Payment pending', variant: 'warning' as const }
  if (company.rentExpired) return { label: 'Ended', variant: 'destructive' as const }
  if (company.onTrial) return { label: 'Trial', variant: 'default' as const }
  return { label: 'Active', variant: 'success' as const }
}

function payToLine(method: RentPaymentMethodInput, settings: Settings): string | null {
  if (method === 'EVC') return settings.evcNumber
  if (method === 'ZAAD') return settings.zaadNumber
  if (method === 'EDAHAB') return settings.edahabNumber
  const bank = [settings.bankName, settings.bankAccountName, settings.bankAccountNumber]
    .filter(Boolean)
    .join(' · ')
  return bank || null
}

function periodLabel(months: number) {
  return `${months} month${months === 1 ? '' : 's'}`
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
  const [method, setMethod] = useState<RentPaymentMethodInput>('EVC')
  const selected = useMemo(() => plans.find((p) => p.id === planId) ?? plans[0], [plans, planId])
  const hasPending = payments.some((p) => p.status === 'PENDING')
  const status = subscriptionStatus(company, hasPending)
  const destination = payToLine(method, settings)
  const canPay = canSubmit && !hasPending && plans.length > 0

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Subscription
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">{company.name}</h2>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Current plan</dt>
            <dd className="font-medium text-foreground">{company.rentNote ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ends</dt>
            <dd className="font-medium text-foreground">
              {company.rentExpiresAt
                ? new Date(company.rentExpiresAt).toLocaleDateString()
                : 'No end date'}
              {company.daysLeft != null ? (
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {company.daysLeft} day{company.daysLeft === 1 ? '' : 's'} left
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Seats</dt>
            <dd className="font-medium text-foreground">
              {company.maxUsers != null ? company.maxUsers : 'No cap'}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground">Plans</h2>
        {plans.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No rent plans are available yet. Ask the system owner to publish plans.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Plan">
            {plans.map((plan) => {
              const chosen = plan.id === (selected?.id ?? '')
              return (
                <button
                  key={plan.id}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => setPlanId(plan.id)}
                  className={cn(
                    'rounded-lg border bg-card p-4 text-left shadow-sm transition-colors',
                    chosen
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border hover:border-foreground/20',
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                  <p className="mt-1 text-lg font-semibold tabular text-foreground">
                    {formatMoney(plan.price, plan.currency)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {periodLabel(plan.months)}
                    {plan.maxUsers != null ? ` · up to ${plan.maxUsers} seats` : ' · no seat cap'}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">How to pay</h2>
          {settings.instructions ? (
            <p className="mt-2 text-sm text-muted-foreground">{settings.instructions}</p>
          ) : null}
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="pay-method">Payment method</Label>
            <select
              id="pay-method"
              value={method}
              onChange={(event) => setMethod(event.target.value as RentPaymentMethodInput)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {rentPaymentMethods.map((item) => (
                <option key={item} value={item}>
                  {RENT_METHOD_LABELS[item]}
                </option>
              ))}
            </select>
          </div>
          {destination ? (
            <p className="mt-1 text-sm tabular text-foreground">{destination}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              This payment method is not set up yet. Choose another method, or ask the system owner.
            </p>
          )}
          {selected ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Amount due {formatMoney(selected.price, selected.currency)} for {periodLabel(selected.months)}.
            </p>
          ) : null}
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
          ) : plans.length === 0 || !selected ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No rent plans are available yet. Ask the system owner to publish plans.
            </p>
          ) : (
            <form action={formAction} className="mt-3 space-y-3">
              <FormStatus state={state} />
              <input type="hidden" name="planId" value={selected.id} />
              <input type="hidden" name="method" value={method} />
              <input type="hidden" name="amount" value={selected.price} />
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Plan · </span>
                {selected.name} · {formatMoney(selected.price, selected.currency)}
              </p>
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
              {state.fieldErrors?.amount?.[0] ? (
                <p className="text-xs text-destructive">{state.fieldErrors.amount[0]}</p>
              ) : null}
              <SubmitButton disabled={!canPay}>Submit for confirmation</SubmitButton>
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
          <Table embed>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="whitespace-normal">
                    {row.planName}
                    {row.reviewNote ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {row.reviewNote}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{periodLabel(row.planMonths)}</TableCell>
                  <TableCell>{RENT_METHOD_LABELS[row.method]}</TableCell>
                  <TableCell className="whitespace-normal">
                    {row.reference}
                    {row.hasReceipt ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Receipt attached
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {formatMoney(row.amount, row.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === 'CONFIRMED'
                          ? 'success'
                          : row.status === 'PENDING'
                            ? 'warning'
                            : 'destructive'
                      }
                    >
                      {RENT_STATUS_LABELS[row.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}

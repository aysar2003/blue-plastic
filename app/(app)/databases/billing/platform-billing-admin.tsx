'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  togglePlatformPlan,
  updateBillingSettingsForm,
  upsertPlatformPlan,
} from '@/app/(app)/billing/actions'
import { PendingRentPayments } from '@/app/(app)/databases/pending-rent-payments'
import { idleState } from '@/components/forms/action-state'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatMoney } from '@/lib/money'
import type { PendingRentPaymentRow } from '@/server/services/platform-billing.service'

type Plan = {
  id: string
  name: string
  months: number
  price: string
  currency: string
  maxUsers: number | null
  active: boolean
  sortOrder: number
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

export function PlatformBillingAdmin({
  plans,
  settings,
  pendingPayments,
}: {
  plans: Plan[]
  settings: Settings
  pendingPayments: PendingRentPaymentRow[]
}) {
  const router = useRouter()
  const [settingsState, settingsAction] = useActionState(updateBillingSettingsForm, idleState)
  const [pending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)

  const toggle = (id: string, active: boolean) => {
    startTransition(async () => {
      const result = await togglePlatformPlan({ id, active })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(active ? 'Plan activated.' : 'Plan hidden.')
      router.refresh()
    })
  }

  const savePlan = (formData: FormData, onSaved?: () => void) => {
    startTransition(async () => {
      const raw = Object.fromEntries(formData.entries())
      const result = await upsertPlatformPlan({
        id: String(raw.id || '') || undefined,
        name: String(raw.name ?? ''),
        months: Number(raw.months),
        price: String(raw.price ?? ''),
        currency: String(raw.currency || 'USD'),
        maxUsers: String(raw.maxUsers ?? ''),
        active: raw.active === 'on' || raw.active === 'true',
        sortOrder: Number(raw.sortOrder || 0),
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(raw.id ? 'Plan updated.' : 'Plan saved.')
      onSaved?.()
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <PendingRentPayments payments={pendingPayments} showWhenEmpty />

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Payment methods</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Companies see only the method they choose on Billing.
        </p>
        <form action={settingsAction} className="mt-4 space-y-4">
          <FormStatus state={settingsState} />
          <fieldset className="space-y-1.5 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-medium text-foreground">EVC Plus</legend>
            <Label htmlFor="evcNumber">EVC number</Label>
            <Input id="evcNumber" name="evcNumber" defaultValue={settings.evcNumber ?? ''} />
          </fieldset>
          <fieldset className="space-y-1.5 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-medium text-foreground">Zaad</legend>
            <Label htmlFor="zaadNumber">Zaad number</Label>
            <Input id="zaadNumber" name="zaadNumber" defaultValue={settings.zaadNumber ?? ''} />
          </fieldset>
          <fieldset className="space-y-1.5 rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-medium text-foreground">eDahab</legend>
            <Label htmlFor="edahabNumber">eDahab number</Label>
            <Input
              id="edahabNumber"
              name="edahabNumber"
              defaultValue={settings.edahabNumber ?? ''}
            />
          </fieldset>
          <fieldset className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
            <legend className="px-1 text-xs font-medium text-foreground">Bank</legend>
            <div className="space-y-1.5">
              <Label htmlFor="bankName">Bank name</Label>
              <Input id="bankName" name="bankName" defaultValue={settings.bankName ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankAccountName">Account name</Label>
              <Input
                id="bankAccountName"
                name="bankAccountName"
                defaultValue={settings.bankAccountName ?? ''}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bankAccountNumber">Account number</Label>
              <Input
                id="bankAccountNumber"
                name="bankAccountNumber"
                defaultValue={settings.bankAccountNumber ?? ''}
              />
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="instructions">Instructions shown to companies</Label>
            <textarea
              id="instructions"
              name="instructions"
              rows={3}
              className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              defaultValue={settings.instructions ?? ''}
            />
          </div>
          <SubmitButton>Save payment methods</SubmitButton>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Plans</h2>
        </div>
        {plans.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">No plans yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {plans.map((plan) =>
              editingId === plan.id ? (
                <li key={plan.id} className="px-5 py-4">
                  <PlanFields
                    plan={plan}
                    pending={pending}
                    submitLabel="Save plan"
                    onCancel={() => setEditingId(null)}
                    onSubmit={(formData) => savePlan(formData, () => setEditingId(null))}
                  />
                </li>
              ) : (
                <li
                  key={plan.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      {plan.name}
                      <Badge variant={plan.active ? 'success' : 'outline'}>
                        {plan.active ? 'Active' : 'Hidden'}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {`${plan.months} month${plan.months === 1 ? '' : 's'} · ${formatMoney(plan.price, plan.currency)}${plan.maxUsers != null ? ` · ${plan.maxUsers} seats` : ' · seats unchanged'}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setEditingId(plan.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => toggle(plan.id, !plan.active)}
                    >
                      {plan.active ? 'Hide' : 'Activate'}
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Add plan</h2>
        <div className="mt-3">
          <PlanFields
            pending={pending}
            submitLabel="Add plan"
            onSubmit={(formData, form) => savePlan(formData, () => form.reset())}
          />
        </div>
      </section>
    </div>
  )
}

function PlanFields({
  plan,
  pending,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  plan?: Plan
  pending: boolean
  submitLabel: string
  onCancel?: () => void
  onSubmit: (formData: FormData, form: HTMLFormElement) => void
}) {
  const idPrefix = plan ? `plan-${plan.id}` : 'new-plan'
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(new FormData(event.currentTarget), event.currentTarget)
      }}
    >
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          required
          defaultValue={plan?.name ?? ''}
          placeholder="e.g. Starter"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-months`}>Months</Label>
        <Input
          id={`${idPrefix}-months`}
          name="months"
          type="number"
          min={1}
          max={60}
          required
          defaultValue={plan?.months ?? 1}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-price`}>Price</Label>
        <Input
          id={`${idPrefix}-price`}
          name="price"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={plan ? Number(plan.price) : undefined}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-currency`}>Currency</Label>
        <Input
          id={`${idPrefix}-currency`}
          name="currency"
          defaultValue={plan?.currency ?? 'USD'}
          maxLength={3}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-maxUsers`}>Max users (blank = leave as-is)</Label>
        <Input
          id={`${idPrefix}-maxUsers`}
          name="maxUsers"
          type="number"
          min={0}
          defaultValue={plan?.maxUsers ?? ''}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-sortOrder`}>Sort order</Label>
        <Input
          id={`${idPrefix}-sortOrder`}
          name="sortOrder"
          type="number"
          defaultValue={plan?.sortOrder ?? 100}
        />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="active"
          value="true"
          defaultChecked={plan ? plan.active : true}
          className="size-4"
        />
        Active (visible on company Billing)
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}

'use client'

import { useActionState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  togglePlatformPlan,
  updateBillingSettingsForm,
  upsertPlatformPlan,
} from '@/app/(app)/billing/actions'
import { idleState } from '@/components/forms/action-state'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatMoney } from '@/lib/money'

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
}: {
  plans: Plan[]
  settings: Settings
}) {
  const router = useRouter()
  const [settingsState, settingsAction] = useActionState(updateBillingSettingsForm, idleState)
  const [pending, startTransition] = useTransition()

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

  const savePlan = (formData: FormData) => {
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
      toast.success('Plan saved.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Pay-to instructions</h2>
        <form action={settingsAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <FormStatus state={settingsState} />
          <div className="space-y-1.5">
            <Label htmlFor="evcNumber">EVC number</Label>
            <Input id="evcNumber" name="evcNumber" defaultValue={settings.evcNumber ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zaadNumber">Zaad number</Label>
            <Input id="zaadNumber" name="zaadNumber" defaultValue={settings.zaadNumber ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edahabNumber">eDahab number</Label>
            <Input
              id="edahabNumber"
              name="edahabNumber"
              defaultValue={settings.edahabNumber ?? ''}
            />
          </div>
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
          <div className="space-y-1.5">
            <Label htmlFor="bankAccountNumber">Account number</Label>
            <Input
              id="bankAccountNumber"
              name="bankAccountNumber"
              defaultValue={settings.bankAccountNumber ?? ''}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="instructions">Instructions shown to companies</Label>
            <textarea
              id="instructions"
              name="instructions"
              rows={3}
              className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              defaultValue={settings.instructions ?? ''}
            />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Save instructions</SubmitButton>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Plans</h2>
        </div>
        <ul className="divide-y divide-border">
          {plans.map((plan) => (
            <li key={plan.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {plan.name}{' '}
                  {!plan.active ? (
                    <span className="text-xs font-normal text-muted-foreground">(hidden)</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.months} month{plan.months === 1 ? '' : 's'} ·{' '}
                  {formatMoney(plan.price, plan.currency)}
                  {plan.maxUsers != null ? ` · ${plan.maxUsers} seats` : ' · seats unchanged'}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => toggle(plan.id, !plan.active)}
              >
                {plan.active ? 'Hide' : 'Activate'}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Add plan</h2>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            savePlan(new FormData(event.currentTarget))
            event.currentTarget.reset()
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="e.g. Starter" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="months">Months</Label>
            <Input id="months" name="months" type="number" min={1} max={60} required defaultValue={1} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price">Price</Label>
            <Input id="price" name="price" type="number" step="0.01" min="0.01" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" name="currency" defaultValue="USD" maxLength={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxUsers">Max users (blank = leave as-is)</Label>
            <Input id="maxUsers" name="maxUsers" type="number" min={0} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sortOrder">Sort order</Label>
            <Input id="sortOrder" name="sortOrder" type="number" defaultValue={100} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="active" value="true" defaultChecked className="size-4" />
            Active (visible on company Billing)
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              Add plan
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

'use client'

import { useActionState } from 'react'

import { submitMarketingLeadForm } from '@/app/(marketing)/actions'
import { idleState } from '@/components/forms/action-state'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function PricingLeadForm() {
  const [state, formAction] = useActionState(submitMarketingLeadForm, idleState)

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-border bg-card/80 p-5">
      <div>
        <p className="text-sm font-semibold text-foreground">Need help?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Prefer to start yourself? Use Start free trial. Or leave a message and we will follow up.
        </p>
      </div>
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lead-name">Your name</Label>
          <Input id="lead-name" name="name" required autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-email">Email</Label>
          <Input id="lead-email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-phone">Phone</Label>
          <Input id="lead-phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-company">Company name</Label>
          <Input id="lead-company" name="companyName" autoComplete="organization" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="lead-message">Message</Label>
          <textarea
            id="lead-message"
            name="message"
            rows={3}
            className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            placeholder="How many users? Sales, inventory, POS?"
          />
        </div>
      </div>
      <SubmitButton>Send request</SubmitButton>
    </form>
  )
}

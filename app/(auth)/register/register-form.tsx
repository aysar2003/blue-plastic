'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Field, fieldProps } from '@/components/forms/field'
import { FormError } from '@/components/forms/form-error'
import { SubmitButton } from '@/components/forms/submit-button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { CURRENCIES, MONTHS } from '@/lib/constants'
import { registerAction, type RegisterState } from './actions'

const initialState: RegisterState = {}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState)
  const v = state.values ?? {}

  if (state.pending) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium text-foreground">Request sent — waiting for approval</p>
        <p className="text-sm text-muted-foreground">
          {state.message ??
            'You will not be able to sign in until the system owner approves your company.'}
        </p>
        <p className="text-xs text-muted-foreground">
          We will keep <span className="font-medium text-foreground">{v.email}</span> until a decision
          is made.
        </p>
        <Link href="/sign-in" className="inline-block text-sm font-medium text-primary underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />

      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Your company</p>

        <Field name="organizationName" label="Company name" required error={state.fieldErrors?.organizationName}>
          <Input
            {...fieldProps('organizationName', state.fieldErrors?.organizationName)}
            defaultValue={v.organizationName ?? ''}
            placeholder="e.g. Hodan Trading"
            autoFocus
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="baseCurrency"
            label="Base currency"
            hint="Ledger reporting currency. Locked after the first posted transaction."
            error={state.fieldErrors?.baseCurrency}
          >
            <select
              {...fieldProps('baseCurrency', state.fieldErrors?.baseCurrency, true)}
              defaultValue={v.baseCurrency ?? 'USD'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            name="fiscalYearStartMonth"
            label="Fiscal year starts"
            error={state.fieldErrors?.fiscalYearStartMonth}
          >
            <select
              {...fieldProps('fiscalYearStartMonth', state.fieldErrors?.fiscalYearStartMonth)}
              defaultValue={v.fiscalYearStartMonth ?? '1'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Owner account</p>

        <Field name="name" label="Your name" required error={state.fieldErrors?.name}>
          <Input {...fieldProps('name', state.fieldErrors?.name)} defaultValue={v.name} required />
        </Field>

        <Field name="email" label="Email" required error={state.fieldErrors?.email}>
          <Input
            {...fieldProps('email', state.fieldErrors?.email)}
            type="email"
            autoComplete="username"
            defaultValue={v.email}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="password"
            label="Password"
            hint="At least 6 characters. Used only after approval."
            required
            error={state.fieldErrors?.password}
          >
            <Input
              {...fieldProps('password', state.fieldErrors?.password, true)}
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <Field name="confirmPassword" label="Confirm password" required error={state.fieldErrors?.confirmPassword}>
            <Input
              {...fieldProps('confirmPassword', state.fieldErrors?.confirmPassword)}
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Submitting sends a request. You cannot open the books until the system owner approves it in
        Databases.
      </p>

      <SubmitButton className="w-full" pendingLabel="Sending request…">
        Request access
      </SubmitButton>
    </form>
  )
}

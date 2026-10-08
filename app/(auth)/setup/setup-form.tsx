'use client'

import { useActionState } from 'react'

import { Field, fieldProps } from '@/components/forms/field'
import { FormError } from '@/components/forms/form-error'
import { SubmitButton } from '@/components/forms/submit-button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { CURRENCIES, MONTHS } from '@/lib/constants'
import { setupAction, type SetupState } from './actions'

const initialState: SetupState = {}

export function SetupForm() {
  const [state, formAction] = useActionState(setupAction, initialState)
  const v = state.values ?? {}

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state.error} />

      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Organisation</p>

        <Field name="organizationName" label="Organisation name" required error={state.fieldErrors?.organizationName}>
          <Input
            {...fieldProps('organizationName', state.fieldErrors?.organizationName)}
            defaultValue={v.organizationName ?? 'Blue Plastic Center'}
            autoFocus
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="baseCurrency"
            label="Base currency"
            hint="The ledger's reporting currency. It cannot be changed once transactions exist."
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
            hint="At least 6 characters. Letters, numbers, and symbols are fine."
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

      <SubmitButton className="w-full" pendingLabel="Creating…">
        Create organisation
      </SubmitButton>
    </form>
  )
}

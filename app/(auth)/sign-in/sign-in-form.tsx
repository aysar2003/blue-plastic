'use client'

import { useActionState } from 'react'

import { Field, fieldProps } from '@/components/forms/field'
import { FormError } from '@/components/forms/form-error'
import { SubmitButton } from '@/components/forms/submit-button'
import { Input } from '@/components/ui/input'
import { signInAction, type SignInState } from './actions'

const initialState: SignInState = {}

/**
 * The inputs are uncontrolled on purpose — the form is submitted as `FormData` to
 * a Server Action, so React holds no credential in component state and none is
 * ever serialised into the page.
 *
 * Do not add `value` or `defaultValue` here. Beyond writing a credential into the
 * HTML that every visitor receives, a `value` without an `onChange` makes the
 * field read-only and the form impossible to type into.
 */
export function SignInForm() {
  const [state, formAction] = useActionState(signInAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />

      <Field name="email" label="Email" required error={state.fieldErrors?.email}>
        <Input
          {...fieldProps('email', state.fieldErrors?.email)}
          type="email"
          autoComplete="username"
          autoFocus
          required
        />
      </Field>

      <Field name="password" label="Password" required error={state.fieldErrors?.password}>
        <Input
          {...fieldProps('password', state.fieldErrors?.password)}
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in to SOM ERP
      </SubmitButton>
    </form>
  )
}

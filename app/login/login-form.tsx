'use client'

import { useActionState } from 'react'

import { Field, fieldProps } from '@/components/forms/field'
import { FormError } from '@/components/forms/form-error'
import { SubmitButton } from '@/components/forms/submit-button'
import { Input } from '@/components/ui/input'
import type { DoorSignInState } from './actions'

const initialState: DoorSignInState = {}

export function LoginForm({
  action,
  submitLabel,
  pendingLabel = 'Signing in…',
  inputClassName,
  labelClassName,
}: {
  action: (prev: DoorSignInState, formData: FormData) => Promise<DoorSignInState>
  submitLabel: string
  pendingLabel?: string
  inputClassName?: string
  labelClassName?: string
}) {
  const [state, formAction] = useActionState(action, initialState)

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
          className={inputClassName}
        />
      </Field>

      <Field name="password" label="Password" required error={state.fieldErrors?.password}>
        <Input
          {...fieldProps('password', state.fieldErrors?.password)}
          type="password"
          autoComplete="current-password"
          required
          className={inputClassName}
        />
      </Field>

      <SubmitButton className={`w-full ${labelClassName ?? ''}`} pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  )
}

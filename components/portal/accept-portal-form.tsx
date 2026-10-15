'use client'

import { useActionState } from 'react'

import { acceptPortalInviteForm, type AcceptPortalState } from '@/app/portal/accept/actions'
import { Field, fieldProps } from '@/components/forms/field'
import { FormError } from '@/components/forms/form-error'
import { SubmitButton } from '@/components/forms/submit-button'
import { Input } from '@/components/ui/input'
import { portalLoginPath } from '@/lib/portal-login'

const initial: AcceptPortalState = {}

export function AcceptPortalForm({
  token,
  defaultName,
  email,
  orgId,
}: {
  token: string
  defaultName: string
  email: string
  orgId: string
}) {
  const [state, action] = useActionState(acceptPortalInviteForm, initial)
  const loginHref = state.loginHref ?? portalLoginPath(orgId)

  if (state.ok) {
    return (
      <div className="space-y-3 text-sm">
        <p className="font-medium text-foreground">Your portal login is ready.</p>
        <p className="text-muted-foreground">
          Sign in with <span className="font-medium text-foreground">{state.email}</span> and the
          password you chose.
        </p>
        <a
          href={loginHref}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Go to sign in
        </a>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <input type="hidden" name="token" value={token} />

      <p className="text-sm text-muted-foreground">
        Email: <span className="font-medium text-foreground">{email}</span>
      </p>

      <Field name="name" label="Your name" required error={state.fieldErrors?.name}>
        <Input
          {...fieldProps('name', state.fieldErrors?.name)}
          defaultValue={defaultName}
          required
          autoFocus
        />
      </Field>

      <Field name="password" label="Password" required error={state.fieldErrors?.password}>
        <Input
          {...fieldProps('password', state.fieldErrors?.password, true)}
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Field
        name="confirmPassword"
        label="Confirm password"
        required
        error={state.fieldErrors?.confirmPassword}
      >
        <Input
          {...fieldProps('confirmPassword', state.fieldErrors?.confirmPassword, true)}
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <SubmitButton className="w-full">Save password</SubmitButton>
    </form>
  )
}

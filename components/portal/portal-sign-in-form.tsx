'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import {
  portalSignInAction,
  resolvePortalCompanyAction,
  type PortalSignInState,
} from '@/app/portal/login/actions'
import { Field, fieldProps } from '@/components/forms/field'
import { FormError } from '@/components/forms/form-error'
import { SubmitButton } from '@/components/forms/submit-button'
import { Input } from '@/components/ui/input'

const initialState: PortalSignInState = {}

export function PortalSignInForm({
  companyId,
  defaultEmail,
  askPassword,
}: {
  companyId?: string
  defaultEmail?: string
  /** True after email lookup on the generic page (no company in the URL). */
  askPassword?: boolean
}) {
  const router = useRouter()
  const branded = Boolean(companyId)
  const showPassword = branded || askPassword

  const [lookupState, lookupAction] = useActionState(resolvePortalCompanyAction, initialState)
  const [signInState, signInAction] = useActionState(portalSignInAction, initialState)

  useEffect(() => {
    if (lookupState.redirectTo) router.replace(lookupState.redirectTo)
  }, [lookupState.redirectTo, router])

  if (!showPassword) {
    return (
      <form action={lookupAction} className="space-y-4">
        <FormError message={lookupState.error} />
        <Field name="email" label="Email" required error={lookupState.fieldErrors?.email}>
          <Input
            {...fieldProps('email', lookupState.fieldErrors?.email)}
            type="email"
            autoComplete="username"
            defaultValue={defaultEmail}
            autoFocus
            required
          />
        </Field>
        <SubmitButton
          className="w-full !bg-sky-400 !text-[#070b14] hover:!bg-sky-300"
          pendingLabel="Looking up…"
        >
          Continue
        </SubmitButton>
        <p className="text-center text-xs text-muted-foreground">
          We open your company&apos;s portal login when your email is linked to one.
        </p>
      </form>
    )
  }

  return (
    <form action={signInAction} className="space-y-4">
      <FormError message={signInState.error} />
      {companyId ? <input type="hidden" name="company" value={companyId} /> : null}

      <Field name="email" label="Email" required error={signInState.fieldErrors?.email}>
        <Input
          {...fieldProps('email', signInState.fieldErrors?.email)}
          type="email"
          autoComplete="username"
          defaultValue={defaultEmail}
          autoFocus={!defaultEmail}
          required
        />
      </Field>

      <Field name="password" label="Password" required error={signInState.fieldErrors?.password}>
        <Input
          {...fieldProps('password', signInState.fieldErrors?.password)}
          type="password"
          autoComplete="current-password"
          autoFocus={Boolean(defaultEmail)}
          required
        />
      </Field>

      <SubmitButton
        className="w-full !bg-sky-400 !text-[#070b14] hover:!bg-sky-300"
        pendingLabel="Signing in…"
      >
        Sign in to portal
      </SubmitButton>
    </form>
  )
}

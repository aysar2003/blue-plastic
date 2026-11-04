'use client'

import { useActionState, useEffect, useState } from 'react'

import { Field, fieldProps } from '@/components/forms/field'
import { FormError } from '@/components/forms/form-error'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  cancelTwoFactorAction,
  completeTwoFactorAction,
  type DoorSignInState,
} from './actions'

const initialState: DoorSignInState = {}

function twoFactorLabel(hint?: DoorSignInState['twoFactorHint']) {
  if (hint === 'totp') return 'Authenticator code'
  if (hint === 'otp') return 'Email code'
  return 'Verification code'
}

function twoFactorHintText(hint?: DoorSignInState['twoFactorHint']) {
  if (hint === 'totp') return 'Open your authenticator app and enter the 6-digit code.'
  if (hint === 'otp') return 'We sent a 6-digit code to your email.'
  return 'Enter the 6-digit code from your authenticator app or email.'
}

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
  const [passwordState, passwordAction] = useActionState(action, initialState)
  const [codeState, codeAction] = useActionState(completeTwoFactorAction, initialState)
  const [step, setStep] = useState<'password' | 'twoFactor'>('password')
  const [hint, setHint] = useState<DoorSignInState['twoFactorHint']>()

  useEffect(() => {
    if (passwordState.needsTwoFactor) {
      setStep('twoFactor')
      setHint(passwordState.twoFactorHint)
    }
  }, [passwordState])

  useEffect(() => {
    if (codeState.needsTwoFactor) {
      setStep('twoFactor')
      if (codeState.twoFactorHint) setHint(codeState.twoFactorHint)
    }
  }, [codeState])

  async function onCancel() {
    await cancelTwoFactorAction()
    setStep('password')
    setHint(undefined)
  }

  if (step === 'twoFactor') {
    return (
      <form action={codeAction} className="space-y-4">
        <FormError message={codeState.error} />
        <p className="text-sm text-muted-foreground">{twoFactorHintText(hint)}</p>

        <Field name="code" label={twoFactorLabel(hint)} required error={codeState.fieldErrors?.code}>
          <Input
            {...fieldProps('code', codeState.fieldErrors?.code)}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={6}
            className={inputClassName}
          />
        </Field>

        <SubmitButton className={`w-full ${labelClassName ?? ''}`} pendingLabel="Checking…">
          Continue
        </SubmitButton>

        <Button type="button" variant="ghost" className="w-full" onClick={() => void onCancel()}>
          Back
        </Button>
      </form>
    )
  }

  return (
    <form action={passwordAction} className="space-y-4">
      <FormError message={passwordState.error} />

      <Field name="email" label="Email or mobile" required error={passwordState.fieldErrors?.email}>
        <Input
          {...fieldProps('email', passwordState.fieldErrors?.email)}
          type="text"
          autoComplete="username"
          autoFocus
          required
          className={inputClassName}
        />
      </Field>

      <Field name="password" label="Password" required error={passwordState.fieldErrors?.password}>
        <Input
          {...fieldProps('password', passwordState.fieldErrors?.password)}
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

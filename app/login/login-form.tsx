'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'

import { Field, fieldProps } from '@/components/forms/field'
import { FormError } from '@/components/forms/form-error'
import { SubmitButton } from '@/components/forms/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  cancelTwoFactorAction,
  completeTwoFactorAction,
  resendTwoFactorOtpAction,
  type DoorSignInState,
} from './actions'

const initialState: DoorSignInState = {}

function twoFactorLabel(hint?: DoorSignInState['twoFactorHint']) {
  if (hint === 'totp') return 'Authenticator code'
  if (hint === 'otp') return 'Email code'
  return 'Verification code'
}

function twoFactorHintText(
  hint?: DoorSignInState['twoFactorHint'],
  emailHint?: string,
) {
  if (hint === 'totp') return 'Open your authenticator app and enter the 6-digit code.'
  if (hint === 'otp') {
    return emailHint
      ? `We sent a 6-digit code to ${emailHint}.`
      : 'We sent a 6-digit code to your email.'
  }
  return emailHint
    ? `Enter the 6-digit code from your authenticator app or ${emailHint}.`
    : 'Enter the 6-digit code from your authenticator app or email.'
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
  const [emailHint, setEmailHint] = useState<string | undefined>()
  const [info, setInfo] = useState<string | undefined>()
  const [resendError, setResendError] = useState<string | undefined>()
  const [cooldown, setCooldown] = useState(0)
  const [resending, startResend] = useTransition()

  useEffect(() => {
    if (passwordState.needsTwoFactor) {
      setStep('twoFactor')
      setHint(passwordState.twoFactorHint)
      setEmailHint(passwordState.emailHint)
      setInfo(undefined)
      setResendError(undefined)
      setCooldown(passwordState.resendAfterSeconds ?? 0)
    }
  }, [passwordState])

  useEffect(() => {
    if (codeState.needsTwoFactor) {
      setStep('twoFactor')
      if (codeState.twoFactorHint) setHint(codeState.twoFactorHint)
      if (codeState.emailHint) setEmailHint(codeState.emailHint)
    }
  }, [codeState])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setInterval(() => {
      setCooldown((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [cooldown])

  async function onCancel() {
    await cancelTwoFactorAction()
    setStep('password')
    setHint(undefined)
    setEmailHint(undefined)
    setInfo(undefined)
    setResendError(undefined)
    setCooldown(0)
  }

  function onResend() {
    if (cooldown > 0 || resending) return
    startResend(async () => {
      setResendError(undefined)
      setInfo(undefined)
      const result = await resendTwoFactorOtpAction()
      if (result.error && !result.needsTwoFactor) {
        setResendError(result.error)
        setStep('password')
        return
      }
      if (result.emailHint) setEmailHint(result.emailHint)
      if (result.twoFactorHint) setHint(result.twoFactorHint)
      if (result.resendAfterSeconds != null) setCooldown(result.resendAfterSeconds)
      if (result.info) setInfo(result.info)
      if (result.error) setResendError(result.error)
    })
  }

  const canResendEmail = hint === 'otp' || hint === 'either'

  if (step === 'twoFactor') {
    return (
      <form action={codeAction} className="space-y-4">
        <FormError message={codeState.error ?? resendError} />
        {info ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{info}</p> : null}
        <p className="text-sm text-muted-foreground">{twoFactorHintText(hint, emailHint)}</p>

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

        {canResendEmail ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={cooldown > 0 || resending}
            onClick={onResend}
          >
            {resending
              ? 'Sending…'
              : cooldown > 0
                ? `Resend code in ${cooldown}s`
                : 'Resend code'}
          </Button>
        ) : null}

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

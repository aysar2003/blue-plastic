'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { idleState, type FormState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  beginEmailOtpForm,
  beginTotpSetupForm,
  changePasswordForm,
  confirmEmailOtpForm,
  confirmTotpSetupForm,
  disableEmailOtpForm,
  disableTotpForm,
  updateProfileForm,
  type TotpSetupState,
} from './actions'

export function ProfileForm({
  name,
  email,
  phone,
}: {
  name: string
  email: string
  phone: string | null
}) {
  const [state, formAction] = useActionState(updateProfileForm, idleState)

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your profile</CardTitle>
          <CardDescription>How you appear on transactions you enter.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormStatus state={state} />

          <Field name="name" label="Name" required error={state.fieldErrors?.name}>
            <Input {...fieldProps('name', state.fieldErrors?.name)} defaultValue={name} required />
          </Field>

          <Field
            name="email-display"
            label="Email"
            hint="Your sign-in address. It is recorded against every entry you make and cannot be changed here."
          >
            <Input id="email-display" value={email} disabled readOnly aria-describedby="email-display-hint" />
          </Field>

          <Field
            name="phone"
            label="Mobile"
            hint="Optional. You can sign in with this number as well as your email."
            error={state.fieldErrors?.phone}
          >
            <Input
              {...fieldProps('phone', state.fieldErrors?.phone)}
              type="tel"
              autoComplete="tel"
              placeholder="+252 61 2345678"
              defaultValue={phone ?? ''}
            />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  )
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordForm, idleState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === 'success') formRef.current?.reset()
  }, [state.status])

  return (
    <form action={formAction} ref={formRef}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>At least 6 characters. Letters, numbers, and symbols are fine.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormStatus state={state} />

          <Field name="currentPassword" label="Current password" required error={state.fieldErrors?.currentPassword}>
            <Input
              {...fieldProps('currentPassword', state.fieldErrors?.currentPassword)}
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="newPassword" label="New password" required error={state.fieldErrors?.newPassword}>
              <Input
                {...fieldProps('newPassword', state.fieldErrors?.newPassword)}
                type="password"
                autoComplete="new-password"
                required
              />
            </Field>

            <Field name="confirmPassword" label="Confirm new password" required error={state.fieldErrors?.confirmPassword}>
              <Input
                {...fieldProps('confirmPassword', state.fieldErrors?.confirmPassword)}
                type="password"
                autoComplete="new-password"
                required
              />
            </Field>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <SubmitButton pendingLabel="Changing…">Change password</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  )
}

const totpIdle: TotpSetupState = idleState

export function TwoFactorForm({
  totpEnabled,
  otp2faEnabled,
}: {
  totpEnabled: boolean
  otp2faEnabled: boolean
}) {
  const [beginTotpState, beginTotpAction] = useActionState(beginTotpSetupForm, totpIdle)
  const [confirmTotpState, confirmTotpAction] = useActionState(confirmTotpSetupForm, totpIdle)
  const [disableTotpState, disableTotpAction] = useActionState(disableTotpForm, idleState)
  const [beginEmailState, beginEmailAction] = useActionState(beginEmailOtpForm, idleState)
  const [confirmEmailState, confirmEmailAction] = useActionState(confirmEmailOtpForm, idleState)
  const [disableEmailState, disableEmailAction] = useActionState(disableEmailOtpForm, idleState)

  const [pendingSecret, setPendingSecret] = useState<string | null>(null)
  const [pendingOtpauth, setPendingOtpauth] = useState<string | null>(null)
  const [emailCodeSent, setEmailCodeSent] = useState(false)

  useEffect(() => {
    if (beginTotpState.secret) {
      setPendingSecret(beginTotpState.secret)
      setPendingOtpauth(beginTotpState.otpauthUrl ?? null)
    }
  }, [beginTotpState])

  useEffect(() => {
    if (confirmTotpState.status === 'success' && !confirmTotpState.secret) {
      setPendingSecret(null)
      setPendingOtpauth(null)
    }
  }, [confirmTotpState])

  useEffect(() => {
    if (beginEmailState.status === 'success') setEmailCodeSent(true)
  }, [beginEmailState])

  useEffect(() => {
    if (confirmEmailState.status === 'success') setEmailCodeSent(false)
  }, [confirmEmailState])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Authenticator app</CardTitle>
          <CardDescription>
            Optional. When on, sign-in asks for a 6-digit code from Google Authenticator or similar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormStatus state={(confirmTotpState.status ? confirmTotpState : beginTotpState) as FormState} />
          {totpEnabled ? (
            <p className="text-sm text-muted-foreground">Authenticator is on for your login.</p>
          ) : pendingSecret ? (
            <div className="space-y-3 rounded-md border border-border p-3 text-sm">
              <p>Add this account in your authenticator app, then enter the code it shows.</p>
              {pendingOtpauth ? (
                <p className="break-all font-mono text-xs text-muted-foreground">{pendingOtpauth}</p>
              ) : null}
              <p className="font-mono text-xs">
                Secret: <span className="select-all">{pendingSecret}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Authenticator is off.</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2">
          {totpEnabled ? (
            <form action={disableTotpAction} className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
              <FormStatus state={disableTotpState} />
              <Field
                name="currentPassword"
                label="Password"
                required
                error={disableTotpState.fieldErrors?.currentPassword}
              >
                <Input
                  {...fieldProps('currentPassword', disableTotpState.fieldErrors?.currentPassword)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <SubmitButton pendingLabel="Turning off…">Turn off</SubmitButton>
            </form>
          ) : pendingSecret ? (
            <form action={confirmTotpAction} className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
              <Field name="code" label="App code" required error={confirmTotpState.fieldErrors?.code}>
                <Input
                  {...fieldProps('code', confirmTotpState.fieldErrors?.code)}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                />
              </Field>
              <SubmitButton pendingLabel="Confirming…">Confirm</SubmitButton>
            </form>
          ) : (
            <form action={beginTotpAction}>
              <SubmitButton pendingLabel="Starting…">Set up authenticator</SubmitButton>
            </form>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email sign-in codes</CardTitle>
          <CardDescription>
            Optional. When on, sign-in sends a 6-digit code to your email after the password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormStatus
            state={
              (confirmEmailState.status
                ? confirmEmailState
                : beginEmailState.status
                  ? beginEmailState
                  : disableEmailState) as FormState
            }
          />
          {otp2faEnabled ? (
            <p className="text-sm text-muted-foreground">Email codes are on for your login.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Email codes are off.</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2">
          {otp2faEnabled ? (
            <form action={disableEmailAction} className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
              <Field
                name="currentPassword"
                label="Password"
                required
                error={disableEmailState.fieldErrors?.currentPassword}
              >
                <Input
                  {...fieldProps('currentPassword', disableEmailState.fieldErrors?.currentPassword)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <SubmitButton pendingLabel="Turning off…">Turn off</SubmitButton>
            </form>
          ) : emailCodeSent ? (
            <form action={confirmEmailAction} className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
              <Field name="code" label="Email code" required error={confirmEmailState.fieldErrors?.code}>
                <Input
                  {...fieldProps('code', confirmEmailState.fieldErrors?.code)}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                />
              </Field>
              <SubmitButton pendingLabel="Confirming…">Confirm</SubmitButton>
            </form>
          ) : (
            <form action={beginEmailAction}>
              <SubmitButton pendingLabel="Sending…">Turn on email codes</SubmitButton>
            </form>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

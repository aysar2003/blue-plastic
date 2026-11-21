'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { idleState, type FormState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DESK_PIN_LENGTHS } from '@/lib/desk-unlock'
import {
  beginEmailOtpForm,
  beginTotpSetupForm,
  changePasswordForm,
  clearDeskPinForm,
  confirmEmailOtpForm,
  confirmTotpSetupForm,
  disableEmailOtpForm,
  disableTotpForm,
  setDeskPinForm,
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

/**
 * Opt-in desk idle-lock PIN (off by default). Not the POS till PIN.
 */
export function DeskPinForm({ hasDeskPin }: { hasDeskPin: boolean }) {
  const [setState, setAction] = useActionState(setDeskPinForm, idleState)
  const [clearState, clearAction] = useActionState(clearDeskPinForm, idleState)
  const setRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (setState.status === 'success') setRef.current?.reset()
  }, [setState.status])

  return (
    <div className="space-y-4">
      <form action={setAction} ref={setRef}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Screen unlock PIN</CardTitle>
            <CardDescription>
              Optional. Off by default. When set, you can unlock the idle screen with a PIN instead
              of your password. Use {DESK_PIN_LENGTHS.join(', ')} digits. This is not the POS till
              PIN.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormStatus state={setState} />
            <p className="text-sm text-muted-foreground">
              Status:{' '}
              <span className="font-medium text-foreground">{hasDeskPin ? 'On' : 'Off'}</span>
            </p>

            <Field
              name="currentPassword"
              label="Current password"
              required
              error={setState.fieldErrors?.currentPassword}
            >
              <Input
                {...fieldProps('currentPassword', setState.fieldErrors?.currentPassword)}
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="pin" label="New PIN" required error={setState.fieldErrors?.pin}>
                <Input
                  {...fieldProps('pin', setState.fieldErrors?.pin)}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  maxLength={10}
                  pattern="\d{4}|\d{6}|\d{8}|\d{10}"
                  title={`Use ${DESK_PIN_LENGTHS.join(', ')} digits`}
                />
              </Field>
              <Field
                name="confirmPin"
                label="Confirm PIN"
                required
                error={setState.fieldErrors?.confirmPin}
              >
                <Input
                  {...fieldProps('confirmPin', setState.fieldErrors?.confirmPin)}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  maxLength={10}
                />
              </Field>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <SubmitButton pendingLabel="Saving…">
              {hasDeskPin ? 'Change PIN' : 'Turn on PIN'}
            </SubmitButton>
          </CardFooter>
        </Card>
      </form>

      {hasDeskPin ? (
        <form action={clearAction}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Turn off screen PIN</CardTitle>
              <CardDescription>
                Idle lock will ask for your login password only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormStatus state={clearState} />
              <Field
                name="currentPassword"
                label="Current password"
                required
                error={clearState.fieldErrors?.currentPassword}
              >
                <Input
                  {...fieldProps('currentPassword', clearState.fieldErrors?.currentPassword)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
            </CardContent>
            <CardFooter className="justify-end">
              <SubmitButton pendingLabel="Turning off…">Turn off PIN</SubmitButton>
            </CardFooter>
          </Card>
        </form>
      ) : null}
    </div>
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
  const [pendingQr, setPendingQr] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [emailCodeSent, setEmailCodeSent] = useState(false)

  useEffect(() => {
    if (beginTotpState.secret) {
      setPendingSecret(beginTotpState.secret)
      setPendingQr(beginTotpState.qrDataUrl ?? null)
      setShowSecret(false)
    }
  }, [beginTotpState])

  useEffect(() => {
    if (confirmTotpState.status === 'success' && !confirmTotpState.secret) {
      setPendingSecret(null)
      setPendingQr(null)
      setShowSecret(false)
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
          <CardTitle className="text-base">Two-factor authentication</CardTitle>
          <CardDescription>
            Like Odoo: use an authenticator app (Google Authenticator, Authy, Microsoft
            Authenticator). Optional unless your company enforces it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormStatus
            state={(confirmTotpState.status ? confirmTotpState : beginTotpState) as FormState}
          />
          <p className="text-sm text-muted-foreground">
            Status:{' '}
            <span className="font-medium text-foreground">{totpEnabled ? 'On' : 'Off'}</span>
          </p>

          {totpEnabled ? (
            <p className="text-sm text-muted-foreground">
              Sign-in asks for a 6-digit code from your authenticator app after your password.
            </p>
          ) : pendingSecret ? (
            <div className="space-y-3 rounded-md border border-border p-3 text-sm">
              <p>Scan this QR code with your authenticator app, then enter the verification code.</p>
              {pendingQr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pendingQr}
                  alt="Authenticator QR code"
                  className="mx-auto size-[220px] rounded-md border border-border bg-white p-2"
                />
              ) : null}
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-primary underline-offset-2 hover:underline"
                  onClick={() => setShowSecret((v) => !v)}
                >
                  {showSecret ? 'Hide secret' : 'Cannot scan it?'}
                </button>
                {showSecret ? (
                  <p className="mt-2 break-all font-mono text-xs select-all">{pendingSecret}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Confirm your password to start setup (Security Control).
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2">
          {totpEnabled ? (
            <form
              action={disableTotpAction}
              className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end"
            >
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
            <form
              action={confirmTotpAction}
              className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end"
            >
              <Field
                name="code"
                label="Verification code"
                required
                error={confirmTotpState.fieldErrors?.code}
              >
                <Input
                  {...fieldProps('code', confirmTotpState.fieldErrors?.code)}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                />
              </Field>
              <SubmitButton pendingLabel="Activating…">Activate</SubmitButton>
            </form>
          ) : (
            <form
              action={beginTotpAction}
              className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end"
            >
              <Field
                name="currentPassword"
                label="Password"
                required
                error={beginTotpState.fieldErrors?.currentPassword}
              >
                <Input
                  {...fieldProps('currentPassword', beginTotpState.fieldErrors?.currentPassword)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <SubmitButton pendingLabel="Starting…">Enable two-factor</SubmitButton>
            </form>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email codes (optional backup)</CardTitle>
          <CardDescription>
            Optional. Sign-in can also accept a 6-digit email code. Does not satisfy company
            Enforce two-factor (authenticator required).
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
            <form
              action={disableEmailAction}
              className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end"
            >
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
            <form
              action={confirmEmailAction}
              className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end"
            >
              <Field
                name="code"
                label="Email code"
                required
                error={confirmEmailState.fieldErrors?.code}
              >
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

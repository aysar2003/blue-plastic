'use client'

import { useActionState, useEffect, useRef } from 'react'

import { idleState } from '@/components/forms/action-state'
import { Field, fieldProps } from '@/components/forms/field'
import { FormStatus } from '@/components/forms/form-status'
import { SubmitButton } from '@/components/forms/submit-button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { changePasswordForm, updateProfileForm } from './actions'

export function ProfileForm({ name, email }: { name: string; email: string }) {
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
          <CardDescription>At least 12 characters.</CardDescription>
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

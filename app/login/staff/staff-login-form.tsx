'use client'

import { useLoginDark } from '@/components/login/login-mode'
import type { DoorSignInState } from '../actions'
import { LoginForm } from '../login-form'

export function StaffLoginForm({
  action,
  submitLabel,
}: {
  action: (prev: DoorSignInState, formData: FormData) => Promise<DoorSignInState>
  submitLabel: string
}) {
  const dark = useLoginDark()
  return (
    <LoginForm
      action={action}
      submitLabel={submitLabel}
      labelClassName={
        dark
          ? '!bg-indigo-600 !text-white hover:!bg-indigo-500'
          : '!bg-indigo-700 !text-white hover:!bg-indigo-800'
      }
    />
  )
}

'use client'

import type { DoorSignInState } from '../actions'
import { LoginForm } from '../login-form'

/** Uses `.login-staff` CSS primary (indigo) — distinct from company cyan. */
export function StaffLoginForm({
  action,
  submitLabel,
}: {
  action: (prev: DoorSignInState, formData: FormData) => Promise<DoorSignInState>
  submitLabel: string
}) {
  return <LoginForm action={action} submitLabel={submitLabel} />
}

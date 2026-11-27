'use client'

import type { DoorSignInState } from '../actions'
import { LoginForm } from '../login-form'

/** Uses `.login-company` CSS primary (cyan) — no indigo override. */
export function CompanyLoginForm({
  action,
  submitLabel,
}: {
  action: (prev: DoorSignInState, formData: FormData) => Promise<DoorSignInState>
  submitLabel: string
}) {
  return <LoginForm action={action} submitLabel={submitLabel} />
}

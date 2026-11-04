import type { Metadata } from 'next'

import { requireOrgContext } from '@/server/auth/context'
import { getTwoFactorStatus } from '@/server/services/auth-2fa.service'
import { PasswordForm, ProfileForm, TwoFactorForm } from './profile-forms'

export const metadata: Metadata = { title: 'Your profile' }

export default async function ProfilePage() {
  const ctx = await requireOrgContext()
  const status = await getTwoFactorStatus(ctx.userId)

  return (
    <div className="space-y-6">
      <ProfileForm name={ctx.user.name} email={ctx.user.email} phone={status.phone} />
      <PasswordForm />
      <TwoFactorForm totpEnabled={status.totpEnabled} otp2faEnabled={status.otp2faEnabled} />
    </div>
  )
}

import type { Metadata } from 'next'

import { requireOrgContext } from '@/server/auth/context'
import { PasswordForm, ProfileForm } from './profile-forms'

export const metadata: Metadata = { title: 'Your profile' }

export default async function ProfilePage() {
  const ctx = await requireOrgContext()

  return (
    <div className="space-y-6">
      <ProfileForm name={ctx.user.name} email={ctx.user.email} />
      <PasswordForm />
    </div>
  )
}

import { redirect } from 'next/navigation'

import { LOGIN_HUB } from '@/lib/login-paths'

export const dynamic = 'force-dynamic'

/** Legacy staff/company URL — send everyone to the login hub. */
export default async function LegacySignInRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : ''
  if (token) {
    redirect(`/portal/accept?token=${encodeURIComponent(token)}`)
  }
  redirect(LOGIN_HUB)
}

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { HubLoginShell } from '@/components/login/hub-login-shell'
import { resumeOrClearSession } from '@/lib/live-session'
import { withDatabasePage } from '@/lib/page-guard'
import { needsSetup } from '@/server/services/setup.service'

export const metadata: Metadata = { title: 'Sign in' }
export const dynamic = 'force-dynamic'

export default async function LoginHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return withDatabasePage(async () => {
    if (await needsSetup()) redirect('/register')

    const params = await searchParams
    const signedOut = params.signedOut === '1' || params.signedOut === 'true'
    await resumeOrClearSession('/login', { signedOut })

    return <HubLoginShell />
  })
}

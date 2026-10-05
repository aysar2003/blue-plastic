import { redirect } from 'next/navigation'

import { Landing } from '@/components/marketing/landing'
import { withDatabasePage } from '@/lib/page-guard'
import { auth } from '@/auth'
import { needsSetup } from '@/server/services/setup.service'

/**
 * Always render per request: this page's output depends on whether an
 * organisation exists and on the caller's session. Prerendering it would freeze
 * that decision at build time.
 */
export const dynamic = 'force-dynamic'

export default async function RootPage() {
  return withDatabasePage(async () => {
    if (await needsSetup()) redirect('/setup')

    // Signed in or not, `/` is the company's public front page — the session only
    // decides whether the header offers the books or the sign-in screen.
    const session = await auth()
    return <Landing signedIn={Boolean(session?.user)} />
  })
}

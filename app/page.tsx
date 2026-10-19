import { redirect } from 'next/navigation'

import { Landing } from '@/components/marketing/landing'
import { withDatabasePage } from '@/lib/page-guard'
import { auth } from '@/auth'
import { needsSetup } from '@/server/services/setup.service'

/**
 * Always render per request: this page's output depends on whether an
 * organisation exists and on the caller's session. Prerendering it would freeze
 * that decision at build time.
 *
 * `/` is the SOM ERP product site. The shop (Al Furaat Plastic Center) lives at
 * `/al-furaat` with its own design and company contact.
 */
export const dynamic = 'force-dynamic'

export default async function RootPage() {
  return withDatabasePage(async () => {
    if (await needsSetup()) redirect('/setup')

    const session = await auth()
    return <Landing signedIn={Boolean(session?.user)} />
  })
}

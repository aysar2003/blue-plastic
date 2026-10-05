import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { withDatabasePage } from '@/lib/page-guard'
import { needsSetup } from '@/server/services/setup.service'
import { SetupForm } from './setup-form'

/**
 * Always render per request: this page's output depends on whether an
 * organisation exists and on the caller's session. Prerendering it would freeze
 * that decision at build time.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Set up' }

/**
 * The only unauthenticated write in the application. It closes permanently once
 * an organisation exists — otherwise it would be an open registration endpoint.
 */
export default async function SetupPage() {
  return withDatabasePage(async () => {
    if (!(await needsSetup())) redirect('/sign-in')

    return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Set up your books</CardTitle>
        <CardDescription>
          This runs once. It creates the organisation and the owner account that can invite everyone else.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SetupForm />
      </CardContent>
    </Card>
    )
  })
}

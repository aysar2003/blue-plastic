import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { withDatabasePage } from '@/lib/page-guard'
import { auth } from '@/auth'
import { needsSetup } from '@/server/services/setup.service'
import { SignInForm } from './sign-in-form'

/**
 * Always render per request: this page's output depends on whether an
 * organisation exists and on the caller's session. Prerendering it would freeze
 * that decision at build time.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Sign in' }

export default async function SignInPage() {
  return withDatabasePage(async () => {
    // An unconfigured instance has nobody to sign in as.
    if (await needsSetup()) redirect('/setup')

    const session = await auth()
    if (session?.user) redirect('/dashboard')

    return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Enter your credentials to reach the books.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm />
      </CardContent>
    </Card>
    )
  })
}

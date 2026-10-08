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
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Enter your credentials to reach the books.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
      <p className="text-center text-[0.6875rem] tracking-wide text-muted-foreground">
        <span className="font-medium text-foreground/80">Abdisalm Hero</span>
        <span className="mx-1.5">·</span>
        System brand
      </p>
    </div>
    )
  })
}

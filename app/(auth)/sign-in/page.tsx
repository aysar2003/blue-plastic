import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { afterSignInPath } from '@/lib/after-sign-in'
import { withDatabasePage } from '@/lib/page-guard'
import { auth } from '@/auth'
import { PRODUCT_CREDIT, PRODUCT_NAME } from '@/lib/product-brand'
import { creatorBrandVisibleBeforeSignIn } from '@/server/services/organization.service'
import { isSelfServeEnabled } from '@/server/services/register.service'
import { needsSetup } from '@/server/services/setup.service'
import { SignInForm } from './sign-in-form'

/**
 * Always render per request: this page's output depends on whether an
 * organisation exists and on the caller's session. Prerendering it would freeze
 * that decision at build time.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Sign in' }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return withDatabasePage(async () => {
    const params = await searchParams
    const token = typeof params.token === 'string' ? params.token : ''
    if (token) {
      redirect(`/portal/accept?token=${encodeURIComponent(token)}`)
    }

    // Empty instance — send people to create the first company.
    if (await needsSetup()) redirect('/register')

    const session = await auth()
    if (session?.user?.id) redirect(await afterSignInPath(session.user.id))

    const showBrand = await creatorBrandVisibleBeforeSignIn()
    const canRegister = isSelfServeEnabled()

    return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Card className="w-full border-border bg-card text-card-foreground shadow-sm">
        <CardHeader>
          <CardTitle>Company login</CardTitle>
          <CardDescription>
            Enter your email and password to open the books.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        Customer?{' '}
        <Link href="/portal/login" className="font-medium text-primary underline">
          Customer portal login
        </Link>
      </p>
      {canRegister ? (
        <p className="text-center text-sm text-muted-foreground">
          New business?{' '}
          <Link href="/register" className="font-medium text-primary underline">
            Create your company
          </Link>
        </p>
      ) : null}
      <p className="text-center text-[0.6875rem] tracking-wide text-muted-foreground">
        <span className="font-medium text-foreground">{PRODUCT_NAME}</span>
        {showBrand ? (
          <>
            <span className="mx-1.5">·</span>
            <span>{PRODUCT_CREDIT}</span>
          </>
        ) : null}
      </p>
    </div>
    )
  })
}

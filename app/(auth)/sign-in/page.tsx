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
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5">
      <Card className="w-full border-border bg-card/95 text-card-foreground shadow-[0_20px_50px_-28px_var(--glow)] backdrop-blur-sm">
        <CardHeader className="space-y-1.5 pb-4">
          <CardTitle className="text-xl tracking-tight">Company login</CardTitle>
          <CardDescription>
            Enter your email and password to open the books.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
      <div className="space-y-2 text-center text-sm text-muted-foreground">
        <p>
          Customer?{' '}
          <Link href="/portal/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Customer portal login
          </Link>
        </p>
        {canRegister ? (
          <p>
            New business?{' '}
            <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Create your company
            </Link>
          </p>
        ) : null}
      </div>
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

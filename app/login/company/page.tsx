import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { CompanyLoginShell } from '@/components/login/company-login-shell'
import { resumeOrClearSession } from '@/lib/live-session'
import { withDatabasePage } from '@/lib/page-guard'
import { creatorBrandVisibleBeforeSignIn } from '@/server/services/organization.service'
import { isSelfServeEnabled } from '@/server/services/register.service'
import { needsSetup } from '@/server/services/setup.service'
import { companySignInAction } from '../actions'
import { LoginForm } from '../login-form'

export const metadata: Metadata = { title: 'Company login' }
export const dynamic = 'force-dynamic'

export default async function CompanyLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return withDatabasePage(async () => {
    if (await needsSetup()) redirect('/register')

    const params = await searchParams
    const signedOut = params.signedOut === '1' || params.signedOut === 'true'
    await resumeOrClearSession('/login/company', { signedOut })

    const showBrand = await creatorBrandVisibleBeforeSignIn()
    const canRegister = isSelfServeEnabled()

    return (
      <CompanyLoginShell showBrand={showBrand} canRegister={canRegister}>
        <LoginForm
          action={companySignInAction}
          submitLabel="Sign in to your company"
          labelClassName="bg-cyan-400 text-[#070b14] hover:bg-cyan-300"
        />
      </CompanyLoginShell>
    )
  })
}

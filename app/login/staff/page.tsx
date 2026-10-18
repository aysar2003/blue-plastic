import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { StaffLoginShell } from '@/components/login/staff-login-shell'
import { resumeOrClearSession } from '@/lib/live-session'
import { withDatabasePage } from '@/lib/page-guard'
import { PRODUCT_NAME } from '@/lib/product-brand'
import { creatorBrandVisibleBeforeSignIn } from '@/server/services/organization.service'
import { needsSetup } from '@/server/services/setup.service'
import { staffSignInAction } from '../actions'
import { StaffLoginForm } from './staff-login-form'

export const metadata: Metadata = { title: 'SOM ERP staff login' }
export const dynamic = 'force-dynamic'

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return withDatabasePage(async () => {
    if (await needsSetup()) redirect('/register')

    const params = await searchParams
    const signedOut = params.signedOut === '1' || params.signedOut === 'true'
    await resumeOrClearSession('/login/staff', { signedOut })

    const showBrand = await creatorBrandVisibleBeforeSignIn()

    return (
      <StaffLoginShell showBrand={showBrand}>
        <StaffLoginForm submitLabel={`Sign in to ${PRODUCT_NAME}`} action={staffSignInAction} />
      </StaffLoginShell>
    )
  })
}

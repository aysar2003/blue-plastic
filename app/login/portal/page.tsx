import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PortalLoginShell } from '@/components/login/portal-login-shell'
import { PortalCompanyBanner } from '@/components/portal/portal-company-banner'
import { PortalSignInForm } from '@/components/portal/portal-sign-in-form'
import { PortalSignOutButton } from '@/components/portal/portal-sign-out-button'
import { afterSignInPath } from '@/lib/after-sign-in'
import { parseFeatureFlags } from '@/lib/feature-flags'
import { withDatabasePage } from '@/lib/page-guard'
import { portalLoginPath } from '@/lib/portal-login'
import { auth } from '@/auth'
import { getOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export const metadata: Metadata = { title: 'Customer portal login' }
export const dynamic = 'force-dynamic'

async function loadCompany(companyId: string | undefined) {
  if (!companyId) return null
  const org = await db.organization.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      legalName: true,
      brandMark: true,
      logoStorageKey: true,
      updatedAt: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      region: true,
      postalCode: true,
      country: true,
      phone: true,
      email: true,
      featureFlags: true,
    },
  })
  if (!org) return null
  if (!parseFeatureFlags(org.featureFlags).enableCustomerPortal) return null
  return {
    orgId: org.id,
    name: org.name,
    legalName: org.legalName,
    brandMark: org.brandMark,
    hasLogo: Boolean(org.logoStorageKey),
    logoVersion: org.updatedAt,
    addressLine1: org.addressLine1,
    addressLine2: org.addressLine2,
    city: org.city,
    region: org.region,
    postalCode: org.postalCode,
    country: org.country,
    phone: org.phone,
    email: org.email,
  }
}

async function canEnterPortalHome(): Promise<boolean> {
  const ctx = await getOrgContext()
  return Boolean(
    ctx?.role === 'CUSTOMER' &&
      ctx.portalCustomerId &&
      ctx.features.enableCustomerPortal,
  )
}

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return withDatabasePage(async () => {
    const params = await searchParams
    const companyId = typeof params.company === 'string' ? params.company : undefined
    const defaultEmail = typeof params.email === 'string' ? params.email : undefined
    const askPassword = params.step === 'password'
    const errorCode = typeof params.error === 'string' ? params.error : undefined
    const company = await loadCompany(companyId)

    const signOutHref = company?.orgId ? portalLoginPath(company.orgId) : '/login/portal'

    const session = await auth()
    let portalBlocked = errorCode === 'unavailable' || errorCode === 'disabled'
    if (session?.user?.id) {
      const ctx = await getOrgContext()
      if (ctx) {
        const home = await afterSignInPath(session.user.id)
        if (home !== '/portal') redirect(home)
        if (await canEnterPortalHome()) redirect('/portal')
      }
      // Stale JWT or portal not available — show the form (do not bounce to /dashboard).
      portalBlocked = true
    }

    return (
      <PortalLoginShell
        banner={
          <PortalCompanyBanner
            name={company?.name}
            legalName={company?.legalName}
            brandMark={company?.brandMark}
            hasLogo={company?.hasLogo}
            orgId={company?.orgId}
            logoVersion={company?.logoVersion}
            addressLine1={company?.addressLine1}
            addressLine2={company?.addressLine2}
            city={company?.city}
            region={company?.region}
            postalCode={company?.postalCode}
            country={company?.country}
            phone={company?.phone}
            email={company?.email}
            showDetails={Boolean(company)}
          />
        }
      >
        <h1 className="text-xl font-semibold tracking-tight">
          {portalBlocked ? 'Portal unavailable' : 'Sign in'}
        </h1>
        <p className="mt-1.5 text-sm opacity-80">
          {portalBlocked
            ? company
              ? `This login cannot open the customer portal for ${company.name}. Ask the company to link your account or turn the portal on, then sign out and try again.`
              : 'This login cannot open the customer portal. Sign out, then use the link your company sent you.'
            : company
              ? `View your invoices and balance with ${company.name}. View only.`
              : askPassword
                ? 'Enter the password your company gave you.'
                : 'Enter your email to open your company’s portal login.'}
        </p>

        <div className="mt-5">
          {portalBlocked ? (
            <PortalSignOutButton callbackUrl={signOutHref} />
          ) : (
            <PortalSignInForm
              companyId={company?.orgId}
              defaultEmail={defaultEmail}
              askPassword={askPassword}
            />
          )}
        </div>
      </PortalLoginShell>
    )
  })
}

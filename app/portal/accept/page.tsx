import type { Metadata } from 'next'
import Link from 'next/link'

import { AcceptPortalForm } from '@/components/portal/accept-portal-form'
import { PortalCompanyBanner } from '@/components/portal/portal-company-banner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { portalLoginPath } from '@/lib/portal-login'
import * as portalService from '@/server/services/portal.service'

export const metadata: Metadata = { title: 'Accept portal invite' }
export const dynamic = 'force-dynamic'

export default async function AcceptPortalInvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const token = typeof params.token === 'string' ? params.token : ''
  const peek = token ? await portalService.peekPortalInvite(token) : null
  const loginHref = peek ? portalLoginPath(peek.orgId) : '/login/portal'

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(70%_50%_at_50%_-5%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_55%)]"
      />

      <PortalCompanyBanner
        name={peek?.organizationName}
        legalName={peek?.legalName}
        brandMark={peek?.brandMark}
        hasLogo={peek?.hasLogo}
        orgId={peek?.orgId}
        logoVersion={peek?.logoVersion}
        addressLine1={peek?.addressLine1}
        addressLine2={peek?.addressLine2}
        city={peek?.city}
        region={peek?.region}
        postalCode={peek?.postalCode}
        country={peek?.country}
        phone={peek?.phone}
        email={peek?.companyEmail}
        showDetails={Boolean(peek)}
      />

      <Card className="w-full max-w-md border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Set your password</CardTitle>
          <CardDescription>
            {peek
              ? `Join ${peek.organizationName} to view your invoices and balance. View only — you cannot change or create transactions.`
              : 'This invite link is invalid, expired, or already used.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {peek ? (
            <AcceptPortalForm
              token={token}
              defaultName={peek.name ?? ''}
              email={peek.email}
              orgId={peek.orgId}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Ask the company for a new invite link, or{' '}
              <Link href={loginHref} className="font-medium text-primary underline">
                sign in
              </Link>{' '}
              if you already have an account.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

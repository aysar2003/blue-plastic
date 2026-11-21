import type { Metadata } from 'next'

import { requireOrgContext } from '@/server/auth/context'
import * as mailService from '@/server/services/mail.service'
import * as organizationService from '@/server/services/organization.service'
import { AccountingForm } from './accounting-form'
import { BrandingForm } from './branding-form'
import { OrganizationForm } from './organization-form'
import { OutboundEmailForm } from './outbound-email-form'
import { SecurityForm } from './security-form'
import { TrustedExtensionsAllowlist } from '@/components/settings/trusted-extensions-allowlist'
import { SignProviderForm } from './sign-provider-form'

export const metadata: Metadata = { title: 'Organisation' }

export default async function OrganizationSettingsPage() {
  const ctx = await requireOrgContext('org:read')
  const organization = await organizationService.get(ctx)
  const signProvider = await organizationService.getSignProvider(ctx)
  const trustedExtensions = await organizationService.getTrustedExtensions(ctx)
  const outboundEmail = await mailService.getOutboundSettings(ctx)
  const canEdit = ctx.permissions.has('org:update')

  return (
    <div className="space-y-6">
      <BrandingForm
        branding={{
          name: organization.name,
          brandMark: organization.brandMark,
          hasLogo: Boolean(organization.logoStorageKey),
          updatedAt: organization.updatedAt,
        }}
        canEdit={canEdit}
      />
      <OrganizationForm organization={organization} canEdit={canEdit} />
      <OutboundEmailForm settings={outboundEmail} canEdit={canEdit} />
      <AccountingForm
        baseCurrency={organization.baseCurrency}
        fiscalYearStartMonth={organization.fiscalYearStartMonth}
        fiscalYearStartDay={organization.fiscalYearStartDay}
        canEdit={canEdit}
      />
      <SecurityForm
        idleLockSeconds={organization.idleLockSeconds}
        sessionMaxHours={organization.sessionMaxHours}
        enforceTwoFactor={organization.enforceTwoFactor}
        canEdit={canEdit}
      />
      <SignProviderForm
        orgId={organization.id}
        signProvider={signProvider}
        canEdit={canEdit}
      />
      <TrustedExtensionsAllowlist trustedExtensions={trustedExtensions} canEdit={canEdit} />
    </div>
  )
}

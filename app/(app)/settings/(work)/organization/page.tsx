import type { Metadata } from 'next'

import { requireOrgContext } from '@/server/auth/context'
import * as organizationService from '@/server/services/organization.service'
import { AccountingForm } from './accounting-form'
import { OrganizationForm } from './organization-form'

export const metadata: Metadata = { title: 'Organisation' }

export default async function OrganizationSettingsPage() {
  const ctx = await requireOrgContext('org:read')
  const organization = await organizationService.get(ctx)
  const canEdit = ctx.permissions.has('org:update')

  return (
    <div className="space-y-6">
      <OrganizationForm organization={organization} canEdit={canEdit} />
      <AccountingForm
        baseCurrency={organization.baseCurrency}
        fiscalYearStartMonth={organization.fiscalYearStartMonth}
        canEdit={canEdit}
      />
    </div>
  )
}

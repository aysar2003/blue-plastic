import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as platformBilling from '@/server/services/platform-billing.service'

import { PlatformBillingAdmin } from './platform-billing-admin'

export const metadata: Metadata = { title: 'Platform billing' }

export default async function PlatformBillingPage() {
  const ctx = await requireOrgContext('org:update')
  if (!ctx.isSystemOwner) redirect('/databases')

  const [plans, settings] = await Promise.all([
    platformBilling.listAllPlans(ctx),
    platformBilling.getBillingSettings(),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform billing</h1>
        <p className="text-sm text-muted-foreground">
          Rent plans and pay-to numbers for SOM ERP. Companies pay from Billing, then you confirm
          under Databases.
        </p>
      </div>
      <PlatformBillingAdmin plans={plans} settings={settings} />
    </div>
  )
}

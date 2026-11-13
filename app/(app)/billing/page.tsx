import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { requireOrgContext } from '@/server/auth/context'
import * as platformBilling from '@/server/services/platform-billing.service'

import { BillingClient } from './billing-client'

export const metadata: Metadata = { title: 'Billing' }

export default async function BillingPage() {
  const ctx = await requireOrgContext('org:read')
  if (ctx.role === 'CUSTOMER') redirect('/portal')

  const data = await platformBilling.companyBillingOverview(ctx)
  const canSubmit =
    ctx.isSystemOwner || ctx.role === 'OWNER' || ctx.role === 'ADMIN'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Subscription, plans, and payment history for this company.
        </p>
      </div>
      <BillingClient
        company={data.company}
        plans={data.plans}
        settings={data.settings}
        payments={data.payments}
        canSubmit={canSubmit}
      />
    </div>
  )
}

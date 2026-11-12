import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { SubscriptionForm } from '@/components/sales/subscription-form'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as recurringService from '@/server/services/recurring.service'

export const metadata: Metadata = { title: 'Subscription' }

export default async function EditSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireOrgContext('invoice:create')
  const { id } = await params
  const row = await recurringService.get(ctx, id)
  if (row.type !== 'INVOICE') redirect('/banking/recurring/' + id)

  const customers = await db.customer.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: 'asc' },
    take: 500,
  })

  const full = await db.recurringTemplate.findFirst({
    where: { id, orgId: ctx.orgId, type: 'INVOICE' },
    select: { deferRevenue: true, serviceMonths: true, payload: true },
  })
  if (!full) notFound()

  const payload = full.payload as {
    customerId?: string
    memo?: string | null
    lines?: { unitPrice?: string; description?: string | null }[]
  }

  return (
    <>
      <PageHeader title={row.name} description="Edit subscription invoice schedule." />
      <SubscriptionForm
        mode="edit"
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        customers={customers.map((c) => ({ id: c.id, label: c.displayName }))}
        initial={{
          id: row.id,
          name: row.name,
          frequency: row.frequency,
          interval: row.interval,
          nextRunOn: row.nextRunOn,
          endOn: row.endOn,
          isActive: row.isActive,
          deferRevenue: full.deferRevenue,
          serviceMonths: full.serviceMonths,
          memo: payload.memo ?? '',
          customerId: payload.customerId ?? '',
          amount: payload.lines?.[0]?.unitPrice ?? '',
          lineDescription: payload.lines?.[0]?.description ?? '',
        }}
      />
    </>
  )
}

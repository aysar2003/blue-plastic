import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { SubscriptionForm } from '@/components/sales/subscription-form'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export const metadata: Metadata = { title: 'New subscription' }

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function NewSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('invoice:create')
  if (!ctx.permissions.has('invoice:create')) redirect('/sales/subscriptions')
  const query = await searchParams

  const customers = await db.customer.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { id: true, displayName: true },
    orderBy: { displayName: 'asc' },
    take: 500,
  })

  return (
    <>
      <PageHeader
        title="New subscription schedule"
        description="Recurring customer invoice. Optionally defer revenue into Unearned and recognize monthly."
      />
      <SubscriptionForm
        mode="create"
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        customers={customers.map((c) => ({ id: c.id, label: c.displayName }))}
        prefill={{
          customerId: one(query.customerId),
          amount: one(query.amount),
          name: one(query.name),
          lineDescription: one(query.description),
        }}
      />
    </>
  )
}

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { BooksTabs } from '@/components/accounts/books-tabs'
import { RecurringForm } from '@/components/banking/recurring-form'
import { PageHeader } from '@/components/data/page-header'
import { accountOptions } from '@/lib/account-options'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as accountService from '@/server/services/account.service'
import { loadPurchaseOptions } from '@/server/services/purchase-options'

export const metadata: Metadata = { title: 'New recurring transaction' }

export default async function NewRecurringPage() {
  const ctx = await requireOrgContext()
  const canJournal = ctx.permissions.has('journal:post')
  const canPurchase = ctx.permissions.has('bill:create')
  if (!canJournal && !canPurchase) redirect('/banking/recurring')

  const [purchase, chart] = await Promise.all([
    canPurchase ? loadPurchaseOptions(ctx) : null,
    canJournal ? accountService.selectableAccounts(ctx) : null,
  ])

  return (
    <>
      <BooksTabs active="recurring" />
      <PageHeader
        title="New recurring transaction"
        description="Save the details once. Each occurrence is created when you run it or Create due."
      />
      <RecurringForm
        mode="create"
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        vendors={purchase?.vendors ?? []}
        expenseAccounts={purchase?.expenseAccounts ?? []}
        paymentAccounts={purchase?.paymentAccounts ?? []}
        journalAccounts={chart ? accountOptions(chart) : []}
        canJournal={canJournal}
        canPurchase={canPurchase}
      />
    </>
  )
}

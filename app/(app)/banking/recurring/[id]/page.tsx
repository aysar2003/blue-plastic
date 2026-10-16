import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BooksTabs } from '@/components/accounts/books-tabs'
import { RecurringRowActions } from '@/components/banking/recurring-actions'
import { initialFromPayload, RecurringForm } from '@/components/banking/recurring-form'
import { PageHeader } from '@/components/data/page-header'
import { buttonVariants } from '@/components/ui/button'
import { accountOptions } from '@/lib/account-options'
import { formatDate, today } from '@/lib/date'
import { RECURRING_TYPE_LABELS } from '@/lib/validation/recurring'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as accountService from '@/server/services/account.service'
import { loadPurchaseOptions } from '@/server/services/purchase-options'
import * as recurringService from '@/server/services/recurring.service'

export const metadata: Metadata = { title: 'Recurring transaction' }

export default async function RecurringDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireOrgContext()

  let row: Awaited<ReturnType<typeof recurringService.get>>
  try {
    row = await recurringService.get(ctx, id)
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound()
    throw error
  }

  const canJournal = ctx.permissions.has('journal:post')
  const canPurchase = ctx.permissions.has('bill:create')
  const canEdit =
    row.type === 'JOURNAL' ? canJournal : canPurchase

  const [purchase, chart] = await Promise.all([
    canPurchase || row.type !== 'JOURNAL' ? loadPurchaseOptions(ctx).catch(() => null) : null,
    canJournal || row.type === 'JOURNAL'
      ? accountService.selectableAccounts(ctx).catch(() => null)
      : null,
  ])

  const initial = initialFromPayload({
    id: row.id,
    name: row.name,
    type: row.type,
    frequency: row.frequency,
    interval: row.interval,
    nextRunOn: row.nextRunOn,
    endOn: row.endOn,
    isActive: row.isActive,
    payload: row.payload,
  })

  return (
    <>
      <BooksTabs active="recurring" />
      <PageHeader
        title={row.name}
        description={`${RECURRING_TYPE_LABELS[row.type]} · next ${formatDate(row.nextRunOn)}${
          row.due ? ' (due)' : ''
        }${row.isActive ? '' : ' · paused'}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RecurringRowActions
              id={row.id}
              name={row.name}
              isActive={row.isActive}
              due={row.due}
              canAct={canEdit}
            />
            <Link href="/banking/recurring" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Back to list
            </Link>
          </div>
        }
      />

      {canEdit ? (
        <RecurringForm
          mode="edit"
          today={today(ctx.organization.timeZone)}
          currency={ctx.organization.baseCurrency}
          vendors={purchase?.vendors ?? []}
          expenseAccounts={purchase?.expenseAccounts ?? []}
          paymentAccounts={purchase?.paymentAccounts ?? []}
          journalAccounts={chart ? accountOptions(chart) : []}
          canJournal={canJournal}
          canPurchase={canPurchase}
          initial={initial}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          You can view this template but need permission to change or create from it.
        </p>
      )}
    </>
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { ReconcileView } from '@/components/banking/reconcile-view'
import { formatDate, toCalendarDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { get } from '@/server/services/reconciliation.service'

export const metadata: Metadata = { title: 'Reconcile' }

export default async function ReconcilePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext('bank:read')
  const { id } = await params

  const reconciliation = await get(ctx, id).catch(() => null)
  if (!reconciliation) notFound()

  const statementDate = toCalendarDate(reconciliation.statementDate)

  return (
    <>

      <PageHeader
        title={`Reconcile ${reconciliation.account.name}`}
        description={`Against the statement to ${formatDate(statementDate)}. Tick everything the statement shows; the difference must reach zero.`}
      />

      <ReconcileView
        id={reconciliation.id}
        accountName={reconciliation.account.name}
        statementDate={formatDate(statementDate)}
        beginningBalance={reconciliation.beginningBalance.toString()}
        statementEndingBalance={reconciliation.statementEndingBalance.toString()}
        completed={reconciliation.status === 'COMPLETED'}
        currency={ctx.organization.baseCurrency}
        canReconcile={ctx.permissions.has('bank:reconcile')}
        lines={reconciliation.lines.map((line) => ({
          lineId: line.lineId,
          journalId: line.journalId,
          journalNumber: line.journalNumber,
          date: line.date.toISOString(),
          description: line.description,
          memo: line.memo,
          sourceType: line.sourceType,
          amount: line.amount.toString(),
          cleared: line.cleared,
        }))}
      />
    </>
  )
}

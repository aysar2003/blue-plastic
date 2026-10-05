import type { Metadata } from 'next'

import { BooksTabs } from '@/components/accounts/books-tabs'
import { StartReconciliationButton } from '@/components/banking/start-reconciliation'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Card } from '@/components/ui/card'
import { today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as bankingService from '@/server/services/banking.service'
import { ScaleIcon } from 'lucide-react'

export const metadata: Metadata = { title: 'Reconcile' }

export default async function ReconcileIndexPage() {
  const ctx = await requireOrgContext('bank:read')
  const accounts = (await bankingService.bankAccounts(ctx)).filter(
    (account) => account.subtype === 'BANK' || account.subtype === 'CREDIT_CARD',
  )
  const asOf = today(ctx.organization.timeZone)
  const canReconcile = ctx.permissions.has('bank:reconcile')

  return (
    <>
      <BooksTabs active="reconcile" />
      <PageHeader
        title="Reconcile"
        description="Pick a bank or card account and enter the statement date and ending balance. Cleared lines stay cleared until that reconciliation is undone."
      />
      {accounts.length === 0 ? (
        <EmptyState icon={ScaleIcon} title="No bank or card accounts yet" description="Add one on the chart, then come back to reconcile it." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {accounts.map((account) => (
            <li key={account.id}>
              <Card className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-muted-foreground tabular">{formatMoney(account.balance, ctx.organization.baseCurrency)}</p>
                </div>
                {canReconcile ? (
                  <StartReconciliationButton accountId={account.id} accountName={account.name} today={asOf} />
                ) : (
                  <span className="text-xs text-muted-foreground">View only</span>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

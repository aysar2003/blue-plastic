import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { BankFeed } from '@/components/banking/bank-feed'
import { StatementWorkbench } from '@/components/banking/statement-workbench'
import { requireOrgContext } from '@/server/auth/context'
import * as bankingService from '@/server/services/banking.service'
import * as feedService from '@/server/services/bank-feed.service'
import { STATEMENT_COLUMNS } from '@/server/services/statement-import.service'

export const metadata: Metadata = { title: 'Import statement' }

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('bank:import')
  const params = await searchParams

  const accounts = (await bankingService.bankAccounts(ctx)).filter(
    (account) => account.subtype === 'BANK' || account.subtype === 'CREDIT_CARD',
  )

  const accountId = typeof params.account === 'string' ? params.account : accounts[0]?.id
  const feed = accountId ? await feedService.feedPage(ctx, accountId) : null

  return (
    <>

      <PageHeader
        title="Bank statement"
        description="An imported line stays off the ledger until you post it or match it. Reconciliation is unchanged: a cleared line stays cleared until that reconciliation is undone."
      />

      <StatementWorkbench
        accounts={accounts.map((a) => ({ id: a.id, label: `${a.code} ${a.name}` }))}
        accountId={accountId ?? ''}
        columns={STATEMENT_COLUMNS}
      />

      {feed && accountId ? (
        <div className="mt-6">
          <BankFeed
            accountId={accountId}
            currency={ctx.organization.baseCurrency}
            lines={feed.lines}
            categories={feed.categories}
            vendors={feed.vendors}
            customers={feed.customers}
            invoices={feed.invoices}
            bills={feed.bills}
          />
        </div>
      ) : null}
    </>
  )
}

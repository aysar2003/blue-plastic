import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { TransferForm } from '@/components/banking/transfer-form'
import { today } from '@/lib/date'
import { accountOptions } from '@/lib/account-options'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import * as accountService from '@/server/services/account.service'

export const metadata: Metadata = { title: 'Transfer' }

export default async function NewTransferPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('bank:transact')
  const params = await searchParams
  const from =
    typeof params.from === 'string' && params.from.length > 0 ? params.from : undefined
  // Every balance-sheet account, money accounts first. A transfer is a movement
  // between the business's own accounts, and which of them count as "money" is
  // the business's decision, not a fixed list of three subtypes.
  const [chart, documentNumber] = await Promise.all([
    accountService.selectableAccounts(ctx, { withBalances: true }),
    peekDocumentNumber(db, ctx.orgId, 'TRANSFER'),
  ])
  const accounts = accountOptions(
    chart.filter((account) => account.type === 'ASSET' || account.type === 'LIABILITY'),
    { prefer: ['BANK', 'CREDIT_CARD', 'UNDEPOSITED_FUNDS', 'OTHER_CURRENT_ASSET'], showBalance: true },
  )

  return (
    <>

      <PageHeader
        title="Transfer between accounts"
        description="Money moves; nothing is earned or spent. This posts only between the two accounts."
      />

      <TransferForm
        accounts={accounts}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        documentNumber={documentNumber}
        defaultFromAccountId={from}
      />
    </>
  )
}

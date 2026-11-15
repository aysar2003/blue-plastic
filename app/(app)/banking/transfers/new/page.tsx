import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { TransferForm } from '@/components/banking/transfer-form'
import { today } from '@/lib/date'
import { accountOptions } from '@/lib/account-options'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import * as accountService from '@/server/services/account.service'
import * as bankingService from '@/server/services/banking.service'

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
  const copyId = typeof params.copy === 'string' ? params.copy : undefined
  const [chart, documentNumber, copySource] = await Promise.all([
    accountService.selectableAccounts(ctx, { withBalances: true }),
    peekDocumentNumber(db, ctx.orgId, 'TRANSFER'),
    copyId ? bankingService.getTransfer(ctx, copyId).catch(() => null) : Promise.resolve(null),
  ])
  if (copyId && !copySource) notFound()

  const accounts = accountOptions(
    chart.filter((account) => account.type === 'ASSET' || account.type === 'LIABILITY'),
    { prefer: ['BANK', 'CREDIT_CARD', 'UNDEPOSITED_FUNDS', 'OTHER_CURRENT_ASSET'], showBalance: true },
  )

  const copySeed = copySource
    ? {
        fromAccountId: copySource.fromAccount.id,
        toAccountId: copySource.toAccount.id,
        amount: copySource.amount,
        reference: copySource.reference,
        memo: copySource.memo,
      }
    : undefined

  return (
    <>
      <PageHeader
        title={
          copySource
            ? `Copy transfer ${copySource.number}`
            : 'Transfer between accounts'
        }
        description="Money moves; nothing is earned or spent. This posts only between the two accounts."
      />

      <TransferForm
        accounts={accounts}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        documentNumber={documentNumber}
        defaultFromAccountId={copySeed ? undefined : from}
        document={copySeed}
        copiedFromNumber={copySource?.number}
      />
    </>
  )
}

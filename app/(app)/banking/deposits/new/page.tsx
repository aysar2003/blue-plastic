import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/data/page-header'
import { DepositForm } from '@/components/banking/deposit-form'
import { accountOptions } from '@/lib/account-options'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import * as accountService from '@/server/services/account.service'
import * as bankingService from '@/server/services/banking.service'

export const metadata: Metadata = { title: 'Make a deposit' }

export default async function NewDepositPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('bank:transact')
  const params = await searchParams
  const bank =
    typeof params.bank === 'string' && params.bank.length > 0 ? params.bank : undefined
  const copyId = typeof params.copy === 'string' ? params.copy : undefined

  const [payments, chart, documentNumber, copySource] = await Promise.all([
    bankingService.undepositedPayments(ctx),
    accountService.selectableAccounts(ctx, { withBalances: true }),
    peekDocumentNumber(db, ctx.orgId, 'DEPOSIT'),
    copyId ? bankingService.getDeposit(ctx, copyId).catch(() => null) : Promise.resolve(null),
  ])
  if (copyId && !copySource) notFound()

  const bankAccounts = accountOptions(
    chart.filter((account) => account.type === 'ASSET' || account.type === 'LIABILITY'),
    { prefer: ['BANK', 'UNDEPOSITED_FUNDS', 'OTHER_CURRENT_ASSET'], showBalance: true },
  )
  const otherAccounts = accountOptions(chart, {
    preferTypes: ['REVENUE', 'EQUITY'],
  })

  const copySeed = copySource
    ? {
        bankAccountId: copySource.bankAccount.id,
        reference: copySource.reference,
        memo: copySource.memo,
        otherLines: copySource.lines
          .filter((line) => line.accountId && !line.customerPaymentId)
          .map((line) => ({
            accountId: line.accountId!,
            description: line.description ?? '',
            amount: line.amount,
          })),
      }
    : undefined

  return (
    <>
      <PageHeader
        title={copySource ? `Copy deposit ${copySource.number}` : 'Make a deposit'}
        description="Take what is in hand to the bank. This clears Undeposited Funds, so the register shows one paying-in slip where the bank shows one — which is what makes reconciliation possible."
      />

      <DepositForm
        bankAccounts={bankAccounts}
        otherAccounts={otherAccounts}
        payments={payments.map((payment) => ({
          id: payment.id,
          number: payment.number,
          date: payment.date.toISOString(),
          amount: payment.amount,
          customer: payment.customer.displayName,
          reference: payment.reference,
        }))}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        documentNumber={documentNumber}
        defaultBankAccountId={copySeed ? undefined : bank}
        document={copySeed}
        copiedFromNumber={copySource?.number}
      />
    </>
  )
}

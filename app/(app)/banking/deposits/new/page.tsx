import type { Metadata } from 'next'

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

  const [payments, chart, documentNumber] = await Promise.all([
    bankingService.undepositedPayments(ctx),
    accountService.selectableAccounts(ctx, { withBalances: true }),
    peekDocumentNumber(db, ctx.orgId, 'DEPOSIT'),
  ])

  // Deposit *to* any account the business banks into; the rest of the chart is
  // still there. The other side of the slip — interest, a refund, an owner's
  // injection — can come from anywhere at all.
  const bankAccounts = accountOptions(
    chart.filter((account) => account.type === 'ASSET' || account.type === 'LIABILITY'),
    { prefer: ['BANK', 'UNDEPOSITED_FUNDS', 'OTHER_CURRENT_ASSET'], showBalance: true },
  )
  const otherAccounts = accountOptions(chart, {
    preferTypes: ['REVENUE', 'EQUITY'],
  })

  return (
    <>

      <PageHeader
        title="Make a deposit"
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
        defaultBankAccountId={bank}
      />
    </>
  )
}

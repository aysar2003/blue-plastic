import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { BANKING_HUB_APPS, visibleHubApps } from '@/components/layout/module-hubs'
import { formatMoney, ZERO } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as bankingService from '@/server/services/banking.service'

export const metadata: Metadata = { title: 'Banking' }

export default async function BankingHubPage() {
  const ctx = await requireOrgContext('bank:read')
  const apps = visibleHubApps(BANKING_HUB_APPS, ctx.permissions)
  const currency = ctx.organization.baseCurrency
  const accounts = await bankingService.bankAccounts(ctx)

  const banks = accounts.filter((account) => account.subtype === 'BANK')
  const cash = banks.reduce((total, account) => total.plus(account.balance), ZERO)
  const uncleared = accounts.reduce((total, account) => total.plus(account.uncleared), ZERO)

  return (
    <AppLauncher
      eyebrow={ctx.organization.name}
      title="Banking"
      subtitle="Accounts the money passes through, and the moves between them."
      apps={apps}
      insights={[
        {
          label: 'In the bank',
          value: formatMoney(cash, currency),
          hint: banks.length === 1 ? '1 bank account' : `${banks.length} bank accounts`,
          href: '/banking/accounts',
        },
        {
          label: 'Accounts',
          value: String(accounts.length),
          hint: 'bank, card and undeposited',
          href: '/banking/accounts',
        },
        {
          label: 'Not cleared',
          value: formatMoney(uncleared, currency),
          hint: 'still to match to the bank',
          href: '/banking/accounts',
        },
      ]}
    />
  )
}

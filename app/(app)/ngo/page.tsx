import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import * as ngo from '@/server/services/ngo.service'

export const metadata: Metadata = { title: 'NGO / nonprofit' }

export default async function NgoHubPage() {
  const ctx = await requireOrgContext('customer:read')
  const [pledges, grants, fundBs] = await Promise.all([
    ngo.listPledges(ctx),
    ngo.grantBudgetReport(ctx),
    ngo.fundBalanceSheet(ctx),
  ])
  const openPledges = pledges.filter((row) => row.status === 'PLEDGED')
  const currency = ctx.organization.baseCurrency

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader
        title="NGO / nonprofit"
        description="Donor pledges, fund tags (classes), grant budget vs actual, and fund BS by class. Not a full fund-restriction engine."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snapshot</CardTitle>
          <CardDescription>
            {openPledges.length} open pledge{openPledges.length === 1 ? '' : 's'} · {grants.length}{' '}
            grant budget{grants.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-4">
            <Link href="/ngo/pledges" className="underline underline-offset-4">
              Donor pledges
            </Link>
            <Link href="/ngo/grants" className="underline underline-offset-4">
              Grant budget vs actual
            </Link>
            <Link href="/settings/classes" className="underline underline-offset-4">
              Funds / programmes
            </Link>
            <Link href="/customers" className="underline underline-offset-4">
              Donors (customers)
            </Link>
          </div>
          {grants.length > 0 ? (
            <ul className="space-y-1 text-muted-foreground">
              {grants.slice(0, 5).map((row) => (
                <li key={row.id}>
                  <span className="text-foreground">{row.name}</span>
                  {row.fund ? ` · ${row.fund}` : ''} · variance{' '}
                  <span className="tabular-nums text-foreground">
                    {formatMoney(row.variance, currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              Create a budget under Accounting → Budgets (optionally tag a fund class), then review
              variance on Grant budget vs actual. Receive open pledges from Donor pledges.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fund balance sheet (by class)</CardTitle>
          <CardDescription>
            Posted journal lines tagged to each fund. Tag transactions with a class under Settings →
            Classes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {fundBs.length === 0 ? (
            <p className="text-muted-foreground">No active funds yet.</p>
          ) : (
            <ul className="space-y-2">
              {fundBs.map((row) => (
                <li key={row.fundId} className="rounded-md border p-3">
                  <p className="font-medium">{row.fundName}</p>
                  <p className="text-muted-foreground">
                    Assets {formatMoney(row.assets, currency)} · Liabilities{' '}
                    {formatMoney(row.liabilities, currency)} · Equity{' '}
                    {formatMoney(row.equityPlusNet, currency)} · Net income{' '}
                    {formatMoney(row.netIncome, currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

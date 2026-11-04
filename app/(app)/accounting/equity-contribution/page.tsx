import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card } from '@/components/ui/card'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import * as equityService from '@/server/services/equity-contribution.service'

import { EquityContributionForm } from './equity-form'

export const metadata: Metadata = { title: 'Owner contribution' }

export default async function EquityContributionPage() {
  const ctx = await requireOrgContext('journal:post')
  const banks = await equityService.listBankAccounts(ctx)

  return (
    <>
      <PageHeader
        title="Owner contribution"
        description="Record cash or bank money the owner put into the company. Posts Dr Bank · Cr Owner's Capital (3000). Not a full shareholders register."
      />
      <Card className="max-w-lg space-y-4 p-6">
        <EquityContributionForm
          baseCurrency={ctx.organization.baseCurrency}
          banks={banks}
          today={today(ctx.organization.timeZone)}
        />
        <p className="text-xs text-muted-foreground">
          Related:{' '}
          <Link
            href="/api/exports/owners-equity"
            className="text-primary underline-offset-2 hover:underline"
          >
            Owner&apos;s equity export
          </Link>
          {' · '}
          <Link href="/settings/accounts" className="text-primary underline-offset-2 hover:underline">
            Chart of accounts
          </Link>
          {' · '}
          <Link
            href="/accounting/fx-revaluation"
            className="text-primary underline-offset-2 hover:underline"
          >
            FX revaluation
          </Link>
        </p>
      </Card>
    </>
  )
}

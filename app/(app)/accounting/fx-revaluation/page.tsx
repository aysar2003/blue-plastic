import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/data/page-header'
import { Card } from '@/components/ui/card'
import { requireOrgContext } from '@/server/auth/context'
import { formatMoney } from '@/lib/money'
import { fxOpenArAp } from '@/server/reports/fx-open-ar-ap'
import * as fxService from '@/server/services/fx-revaluation.service'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { FxRevaluationForm } from './fx-form'

export const metadata: Metadata = { title: 'FX revaluation' }

export default async function FxRevaluationPage() {
  const ctx = await requireOrgContext('journal:read')
  const [currencies, openFx] = await Promise.all([
    fxService.listForeignCurrencies(ctx),
    fxOpenArAp(ctx),
  ])
  const canPost = ctx.permissions.has('journal:post')
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="FX revaluation"
        description={`Restate open foreign AR/AP into ${ctx.organization.baseCurrency} at a new rate. Posts an adjusting journal to Exchange Gain/Loss.`}
      />
      {openFx.length > 0 ? (
        <Card className="mb-6 max-w-3xl p-4">
          <h2 className="mb-2 text-sm font-medium">Open foreign AR/AP by currency</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Currency</TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Foreign</TableHead>
                <TableHead className="text-right">Base ({currency})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openFx.map((row) => (
                <TableRow key={`${row.currencyCode}-${row.side}`}>
                  <TableCell>{row.currencyCode}</TableCell>
                  <TableCell>{row.side}</TableCell>
                  <TableCell className="text-right">{row.foreignBalance.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(row.baseBalance.toFixed(2), currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      <Card className="max-w-lg space-y-4 p-6">
        {currencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No foreign-currency journals yet. Set a customer currency and FX rate on an invoice,
            post it, then return here.
          </p>
        ) : canPost ? (
          <FxRevaluationForm currencies={currencies} baseCurrency={ctx.organization.baseCurrency} />
        ) : (
          <p className="text-sm text-muted-foreground">You need journal:post to run a revaluation.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Chart guidance:{' '}
          <Link href="/settings/accounts" className="text-primary underline-offset-2 hover:underline">
            Chart of accounts
          </Link>{' '}
          includes Owner&apos;s Capital (3000) and Exchange Gain/Loss.
        </p>
      </Card>
    </>
  )
}

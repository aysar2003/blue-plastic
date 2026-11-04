import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { FX_HEDGE_KINDS, FX_HEDGE_LEGAL, canSettleHedge } from '@/lib/erp/fx-hedge'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as hedges from '@/server/services/fx-hedge.service'

import { cancelHedge, createHedge, settleHedge } from './actions'

export const metadata: Metadata = { title: 'FX hedges' }

export default async function FxHedgesPage() {
  const ctx = await requireOrgContext('journal:read')
  const [rows, accounts] = await Promise.all([
    hedges.listHedges(ctx),
    db.ledgerAccount.findMany({
      where: { orgId: ctx.orgId, isActive: true, subtype: { in: ['BANK', 'CREDIT_CARD'] } },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
      take: 80,
    }),
  ])
  const canPost = ctx.permissions.has('journal:post')

  return (
    <>
      <PageHeader
        title="FX hedges"
        description="Document cash-flow or fair-value hedges, then settle mark-to-market against Exchange Gain/Loss."
      />
      <p className="mb-4 max-w-2xl text-xs text-muted-foreground">{FX_HEDGE_LEGAL}</p>
      {canPost ? (
        <Card className="mb-6 max-w-xl space-y-2 p-4">
          <h2 className="font-medium">New hedge (documentation)</h2>
          <form action={createHedge} className="grid gap-2 sm:grid-cols-2">
            <NativeSelect name="kind">
              {FX_HEDGE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind.replace('_', ' ')}
                </option>
              ))}
            </NativeSelect>
            <Input name="currencyCode" placeholder="EUR" required maxLength={3} />
            <Input name="contractRate" placeholder="Contract rate" required />
            <Input name="notional" placeholder="Notional" required />
            <Input name="maturityDate" type="date" required />
            <Input name="counterpart" placeholder="Counterparty (optional)" />
            <Input name="risk" placeholder="Risk (e.g. EUR AR)" required className="sm:col-span-2" />
            <Input name="hedgedItem" placeholder="Hedged item" required className="sm:col-span-2" />
            <Input name="instrument" placeholder="Instrument (forward / swap)" required className="sm:col-span-2" />
            <Button type="submit" size="sm" className="sm:col-span-2">
              Record hedge
            </Button>
          </form>
        </Card>
      ) : null}
      <ul className="space-y-3 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border px-3 py-2">
            <div className="font-medium">
              {row.currencyCode} {row.notional.toString()} @ {row.contractRate.toString()} · {row.kind} · {row.status}
            </div>
            <p className="text-muted-foreground">
              {row.risk} · {row.hedgedItem} · {row.instrument}
            </p>
            {canPost && canSettleHedge(row.status) ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <form action={settleHedge} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={row.id} />
                  <Input name="spotRate" placeholder="Spot" required className="w-24" />
                  <NativeSelect name="accountId" required>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} {account.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button type="submit" size="sm" variant="secondary">
                    Settle MTM
                  </Button>
                </form>
                <form action={cancelHedge}>
                  <input type="hidden" name="id" value={row.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Cancel
                  </Button>
                </form>
              </div>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? <li className="text-muted-foreground">No hedges yet.</li> : null}
      </ul>
    </>
  )
}

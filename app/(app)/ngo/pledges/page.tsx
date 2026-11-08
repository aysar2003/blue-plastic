import type { Metadata } from 'next'
import Link from 'next/link'

import { createPledgeAction, receivePledgeAction } from '@/app/(app)/ngo/actions'
import { EmptyState } from '@/components/data/empty-state'
import { PageHeader } from '@/components/data/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { today } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as ngo from '@/server/services/ngo.service'
import { selectableAccounts } from '@/server/services/account.service'

export const metadata: Metadata = { title: 'Donor pledges' }

export default async function NgoPledgesPage() {
  const ctx = await requireOrgContext('payment:create')
  const [pledges, customers, funds, accounts] = await Promise.all([
    ngo.listPledges(ctx),
    db.customer.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 500,
    }),
    db.trackingCategory.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    selectableAccounts(ctx, { withBalances: false }),
  ])
  const banks = accounts.filter(
    (account) => account.subtype === 'BANK' || account.subtype === 'UNDEPOSITED_FUNDS',
  )
  const currency = ctx.organization.baseCurrency

  return (
    <>
      <PageHeader
        title="Donor pledges"
        description="Record a pledge against a fund, then receive it as a customer payment."
        actions={
          <Link href="/ngo" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            NGO hub
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <form action={createPledgeAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              Donor
              <NativeSelect name="customerId" required className="mt-1">
                <option value="">Choose…</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.displayName}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Amount
              <Input name="amount" required className="mt-1" />
            </label>
            <label className="text-sm">
              Fund
              <NativeSelect name="trackingCategoryId" className="mt-1">
                <option value="">None</option>
                {funds.map((fund) => (
                  <option key={fund.id} value={fund.id}>
                    {fund.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="text-sm">
              Pledged
              <Input
                name="pledgedAt"
                type="date"
                defaultValue={today(ctx.organization.timeZone)}
                className="mt-1"
              />
            </label>
            <label className="text-sm">
              Purpose
              <Input name="purpose" className="mt-1" placeholder="Optional" />
            </label>
            <div className="flex items-end">
              <button type="submit" className={buttonVariants({ size: 'sm' })}>
                Add pledge
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {pledges.length === 0 ? (
        <EmptyState title="No pledges" description="Add a donor customer, then record a pledge." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Donor</TableHead>
              <TableHead>Fund</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pledges.map((pledge) => (
              <TableRow key={pledge.id}>
                <TableCell className="font-medium">{pledge.customer.displayName}</TableCell>
                <TableCell>{pledge.trackingCategory?.name ?? '—'}</TableCell>
                <TableCell className="tabular">
                  {formatMoney(pledge.amount.toString(), currency)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{pledge.status}</Badge>
                  {pledge.payment ? (
                    <Link
                      href={`/payments/${pledge.payment.id}`}
                      className="ml-2 text-xs underline underline-offset-4"
                    >
                      {pledge.payment.number}
                    </Link>
                  ) : null}
                </TableCell>
                <TableCell className="text-right">
                  {pledge.status === 'PLEDGED' && banks[0] ? (
                    <form action={receivePledgeAction} className="inline-flex items-center gap-2">
                      <input type="hidden" name="pledgeId" value={pledge.id} />
                      <NativeSelect name="depositAccountId" className="h-8 text-xs" defaultValue={banks[0].id}>
                        {banks.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} {account.name}
                          </option>
                        ))}
                      </NativeSelect>
                      <button type="submit" className={buttonVariants({ size: 'sm' })}>
                        Receive
                      </button>
                    </form>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}

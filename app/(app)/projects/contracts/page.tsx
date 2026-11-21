import type { Metadata } from 'next'
import Link from 'next/link'

import {
  activateContractAction,
  billMilestoneAction,
  updateContractAmountsAction,
} from '@/app/(app)/projects/contracts/actions'
import { PageHeader } from '@/components/data/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { formatMoney } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as construction from '@/server/services/construction.service'

export const metadata: Metadata = { title: 'Sales contracts' }

export default async function ProjectContractsPage() {
  const ctx = await requireOrgContext('invoice:read')
  const [contracts, items] = await Promise.all([
    construction.listContracts(ctx),
    db.item.findMany({
      where: { orgId: ctx.orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ])
  const currency = ctx.organization.baseCurrency
  const canBill = ctx.permissions.has('invoice:create')

  return (
    <>
      <PageHeader
        title="Sales contracts"
        description="Milestone billing on customer contracts. Vendor bill retention release stays on progress billing."
        actions={
          <Link href="/projects/progress" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Progress billing
          </Link>
        }
      />

      <div className="space-y-4">
        {contracts.map((contract) => (
          <Card key={contract.id}>
            <CardContent className="space-y-3 p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">
                  {contract.number} · {contract.name} · {contract.status}
                </p>
                <p>{formatMoney(contract.effectiveValue, currency)}</p>
              </div>
              <p className="text-muted-foreground">
                Billed {formatMoney(contract.billedAmount, currency)} · remaining{' '}
                {formatMoney(contract.remainingAmount, currency)}
                {contract.changeOrderAmount && Number(contract.changeOrderAmount) !== 0
                  ? ` · change orders ${formatMoney(contract.changeOrderAmount, currency)}`
                  : ''}
                {contract.retentionPercent ? ` · retainage ${contract.retentionPercent}%` : ''}
              </p>
              {contract.customer ? <p>Customer: {contract.customer.displayName}</p> : null}
              {contract.project ? (
                <p>
                  Project: {contract.project.number} · {contract.project.name}
                </p>
              ) : null}
              {canBill && contract.status !== 'CANCELLED' ? (
                <form action={updateContractAmountsAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="contractId" value={contract.id} />
                  <label className="text-xs">
                    Change-order amount
                    <Input
                      name="changeOrderAmount"
                      className="mt-1 h-8 w-32"
                      defaultValue={contract.changeOrderAmount}
                    />
                  </label>
                  <label className="text-xs">
                    Retainage %
                    <Input
                      name="retentionPercent"
                      className="mt-1 h-8 w-24"
                      defaultValue={contract.retentionPercent ?? ''}
                    />
                  </label>
                  <Button type="submit" size="sm" variant="outline">
                    Save
                  </Button>
                </form>
              ) : null}
              {canBill && contract.status === 'DRAFT' ? (
                <form action={activateContractAction}>
                  <input type="hidden" name="contractId" value={contract.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    Activate
                  </Button>
                </form>
              ) : null}
              <ul className="space-y-2 border-t pt-2">
                {contract.milestones.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {m.name} — {m.percent.toString()}%
                      {m.billedAt ? ' · billed' : ''}
                    </span>
                    {canBill && contract.status === 'ACTIVE' && !m.billedAt ? (
                      <form action={billMilestoneAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="contractId" value={contract.id} />
                        <input type="hidden" name="milestoneId" value={m.id} />
                        <NativeSelect name="itemId" className="h-8 w-48" required defaultValue={items[0]?.id}>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </NativeSelect>
                        <Input name="description" placeholder="Memo" className="h-8 w-40" />
                        <Button type="submit" size="sm">
                          Bill
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
        {contracts.length === 0 ? (
          <Card className="px-4 py-8 text-sm text-muted-foreground">
            No contracts yet. Create via API / seed or add a creation form in a later pass.
          </Card>
        ) : null}
      </div>
    </>
  )
}
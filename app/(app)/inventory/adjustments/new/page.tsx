import type { Metadata } from 'next'

import { PageHeader } from '@/components/data/page-header'
import { AdjustmentForm } from '@/components/inventory/adjustment-form'
import { accountOptions } from '@/lib/account-options'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { peekDocumentNumber } from '@/server/sequences'
import * as accountService from '@/server/services/account.service'
import * as inventoryService from '@/server/services/inventory.service'

export const metadata: Metadata = { title: 'Adjust stock' }

export default async function NewAdjustmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('inventory:adjust')
  const query = await searchParams
  const itemId = typeof query.item === 'string' ? query.item : undefined
  const mode = query.mode === 'damage' || query.mode === 'cost' ? query.mode : 'count'

  const [stock, accounts, documentNumber] = await Promise.all([
    inventoryService.stockOnHand(ctx),
    accountService.selectableAccounts(ctx),
    peekDocumentNumber(db, ctx.orgId, 'INVENTORY_ADJUSTMENT'),
  ])

  return (
    <>

      <PageHeader
        title="Adjust stock"
        description="Count what is there, record what was damaged, or add cost onto an item. Damage leaves the cost on what remains, so the cost rises. Adding cost does the same with an amount you type. The lines stay open down the page."
      />

      <AdjustmentForm
        initialMode={mode}
        items={stock.items.map((item) => ({
          id: item.itemId,
          label: item.sku ? `${item.sku} — ${item.name}` : item.name,
          sku: item.sku,
          onHand: item.quantity.toFixed(2),
          averageCost: item.averageCost.toFixed(6),
        }))}
        accounts={accountOptions(accounts, {
          prefer: ['OPERATING_EXPENSE', 'COST_OF_GOODS_SOLD', 'OTHER_EXPENSE'],
          preferTypes: ['EXPENSE', 'REVENUE'],
        })}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        documentNumber={documentNumber}
        initialItemId={itemId}
      />
    </>
  )
}

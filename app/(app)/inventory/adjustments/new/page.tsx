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
import * as storeService from '@/server/services/store.service'

export const metadata: Metadata = { title: 'Adjust stock' }

export default async function NewAdjustmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireOrgContext('inventory:adjust')
  const query = await searchParams
  const itemId = typeof query.item === 'string' ? query.item : undefined
  const storeId = typeof query.store === 'string' ? query.store : undefined
  const mode = query.mode === 'damage' || query.mode === 'cost' ? query.mode : 'count'

  const [stock, shelf, accounts, documentNumber] = await Promise.all([
    inventoryService.stockOnHand(ctx),
    storeService.quantities(ctx),
    accountService.selectableAccounts(ctx),
    peekDocumentNumber(db, ctx.orgId, 'INVENTORY_ADJUSTMENT'),
  ])

  return (
    <>

      <PageHeader
        title="Adjust stock"
        description="Count what is on that store's shelf, record what was damaged, or add cost onto an item. Damage leaves the cost on what remains, so the cost rises. Adding cost does the same with an amount you type. The lines stay open down the page."
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
        stores={shelf.stores.map((store) => ({
          id: store.id,
          label: store.name,
          isOffice: store.isOffice,
        }))}
        stockByStore={shelf.byItem}
        accounts={accountOptions(accounts, {
          prefer: ['COST_OF_GOODS_SOLD', 'OPERATING_EXPENSE', 'OTHER_EXPENSE'],
          preferTypes: ['COGS', 'EXPENSE', 'REVENUE'],
        })}
        today={today(ctx.organization.timeZone)}
        currency={ctx.organization.baseCurrency}
        documentNumber={documentNumber}
        initialItemId={itemId}
        initialStoreId={storeId}
      />
    </>
  )
}

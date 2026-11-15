import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

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
  const copyId = typeof query.copy === 'string' ? query.copy : undefined

  const [stock, shelf, accounts, documentNumber, copySource] = await Promise.all([
    inventoryService.stockOnHand(ctx),
    storeService.quantities(ctx),
    accountService.selectableAccounts(ctx),
    peekDocumentNumber(db, ctx.orgId, 'INVENTORY_ADJUSTMENT'),
    copyId ? inventoryService.getAdjustment(ctx, copyId).catch(() => null) : Promise.resolve(null),
  ])
  if (copyId && !copySource) notFound()

  const copySeed = copySource
    ? {
        storeId: copySource.store?.id ?? '',
        accountId: copySource.account?.id ?? '',
        reason: copySource.reason,
        memo: copySource.memo,
        mode: 'count' as const,
        lines: copySource.lines
          .filter((line) => line.item?.id)
          .map((line) => ({
            itemId: line.item!.id,
            counted: line.countedQuantity,
            description: line.description ?? '',
          })),
      }
    : undefined

  return (
    <>
      <PageHeader
        title={copySource ? `Copy adjustment ${copySource.number}` : 'Adjust stock'}
        description="Count what is on that store's shelf, record what was damaged, or add cost onto an item. Damage leaves the cost on what remains, so the cost rises. Adding cost does the same with an amount you type. The lines stay open down the page."
      />

      <AdjustmentForm
        initialMode={copySeed ? copySeed.mode : mode}
        items={stock.items.map((item) => ({
          id: item.itemId,
          label: item.sku ? `${item.sku} — ${item.name}` : item.name,
          sku: item.sku,
          unitOfMeasure: item.unitOfMeasure,
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
        initialItemId={copySeed ? undefined : itemId}
        initialStoreId={copySeed ? undefined : storeId}
        document={copySeed}
        copiedFromNumber={copySource?.number}
      />
    </>
  )
}

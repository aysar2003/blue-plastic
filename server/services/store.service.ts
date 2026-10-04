import 'server-only'

import { Decimal, ZERO } from '@/lib/money'
import { foldStoreQuantities, type StockByStore, type StoreChoice } from '@/lib/store-stock'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { conflict, notFound } from '@/server/errors'
import * as accountService from '@/server/services/account.service'
import { valuation } from '@/server/accounting/inventory'

export type StoreColumn = StoreChoice

const STORE_COLUMN = { id: true, name: true, isOffice: true } as const

export async function list(ctx: OrgContext) {
  return db.store.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: {
      id: true,
      name: true,
      isOffice: true,
      account: { select: { id: true, code: true, name: true } },
      _count: { select: { items: { where: { deletedAt: null } } } },
    },
    orderBy: [{ isOffice: 'desc' }, { name: 'asc' }],
  })
}

/**
 * A store and the inventory account named for it.
 * The account sits with Inventory Asset on the chart. It is not a child of
 * that account, because a parent cannot take postings and the stock already
 * posted there has to stay postable.
 */
export async function create(ctx: OrgContext, name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw conflict('Give the store a name.')
  const taken = await db.store.findFirst({
    where: { orgId: ctx.orgId, name: trimmed },
    select: { id: true },
  })
  if (taken) throw conflict(`A store called "${trimmed}" already exists.`)

  const codes = await db.ledgerAccount.findMany({
    where: { orgId: ctx.orgId },
    select: { code: true },
  })
  const used = new Set(codes.map((row) => row.code))
  let number = 1210
  while (used.has(String(number)) && number < 1299) number += 1
  if (used.has(String(number))) throw conflict('There is no free account number left beside Inventory Asset.')

  const account = await accountService.create(ctx, {
    code: String(number),
    name: trimmed,
    description: `Inventory held at ${trimmed}. Listed with Inventory Asset.`,
    type: 'ASSET',
    subtype: 'INVENTORY',
    detailType: 'Store',
  })

  return db.store.create({
    data: { orgId: ctx.orgId, name: trimmed, inventoryAccountId: account.id },
    select: { id: true, name: true },
  })
}

async function findOffice(ctx: OrgContext): Promise<StoreColumn | null> {
  const named = await db.store.findFirst({
    where: { orgId: ctx.orgId, OR: [{ isOffice: true }, { name: 'Xafiiska' }] },
    select: { id: true, name: true, isOffice: true, isActive: true },
  })
  if (!named) return null
  if (!named.isOffice || !named.isActive) {
    await db.store.update({ where: { id: named.id }, data: { isOffice: true, isActive: true } })
  }
  return { id: named.id, name: named.name, isOffice: true }
}

/** The office store. Created once, with an inventory account and no opening balance. */
export async function ensureOffice(ctx: OrgContext): Promise<StoreColumn> {
  const found = await findOffice(ctx)
  if (found) return found
  try {
    const created = await create(ctx, 'Xafiiska')
    await db.store.update({ where: { id: created.id }, data: { isOffice: true } })
    return { id: created.id, name: created.name, isOffice: true }
  } catch (error) {
    const again = await findOffice(ctx)
    if (again) return again
    throw error
  }
}

export async function columns(ctx: OrgContext): Promise<StoreColumn[]> {
  await ensureOffice(ctx)
  return db.store.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: STORE_COLUMN,
    orderBy: [{ isOffice: 'desc' }, { name: 'asc' }],
  })
}

/** Quantity of every tracked item in every store. Null movements count at the office. */
export async function quantities(ctx: OrgContext): Promise<{ stores: StoreColumn[]; byItem: StockByStore }> {
  const stores = await columns(ctx)
  const officeId = stores.find((store) => store.isOffice)?.id ?? ''
  const groups = await db.inventoryTransaction.groupBy({
    by: ['itemId', 'storeId'],
    where: { orgId: ctx.orgId },
    _sum: { quantity: true },
  })
  const byItem = foldStoreQuantities(
    groups.map((row) => ({
      itemId: row.itemId,
      storeId: row.storeId,
      quantity: row._sum.quantity?.toString() ?? '0',
    })),
    officeId,
  )
  return { stores, byItem }
}

/** The inventory account a line should hit when it names a store. */
export async function accountsFor(
  tx: Tx,
  orgId: string,
  storeIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(storeIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return new Map()
  const rows = await tx.store.findMany({
    where: { orgId, id: { in: ids } },
    select: { id: true, inventoryAccountId: true },
  })
  return new Map(rows.map((row) => [row.id, row.inventoryAccountId]))
}

export type StoreCard = StoreColumn & {
  code: string
  accountName: string
  inStock: number
  zero: number
  negative: number
}

/** One card per store: what it holds, what is gone, and what has gone below zero. */
export async function overview(ctx: OrgContext): Promise<StoreCard[]> {
  const [shelf, items, stores] = await Promise.all([
    quantities(ctx),
    db.item.findMany({
      where: { orgId: ctx.orgId, type: 'INVENTORY', deletedAt: null, isActive: true },
      select: { id: true },
    }),
    list(ctx),
  ])
  const accounts = new Map(stores.map((store) => [store.id, store.account]))
  return shelf.stores.map((store) => {
    let inStock = 0
    let negative = 0
    for (const item of items) {
      const qty = Number(shelf.byItem[item.id]?.[store.id] ?? '0')
      if (qty < 0) negative += 1
      else if (qty > 0) inStock += 1
    }
    const account = accounts.get(store.id)
    return {
      ...store,
      code: account?.code ?? '',
      accountName: account?.name ?? store.name,
      inStock,
      negative,
      zero: items.length - inStock - negative,
    }
  })
}

export type StoreView = 'all' | 'in' | 'zero' | 'negative'

/** What this store is holding, including zeros and quantities below zero. */
export async function report(ctx: OrgContext, id: string, view: StoreView = 'all') {
  const store = await db.store.findFirst({
    where: { id, orgId: ctx.orgId, isActive: true },
    select: {
      id: true,
      name: true,
      isOffice: true,
      account: { select: { id: true, code: true, name: true } },
    },
  })
  if (!store) throw notFound('Store')

  const [shelf, catalog, valued, balanceRow] = await Promise.all([
    quantities(ctx),
    db.item.findMany({
      where: { orgId: ctx.orgId, type: 'INVENTORY', deletedAt: null, isActive: true },
      select: { id: true, name: true, sku: true },
      orderBy: { name: 'asc' },
    }),
    valuation(db as unknown as Tx, ctx.orgId),
    db.journalLine.aggregate({
      where: {
        orgId: ctx.orgId,
        accountId: store.account.id,
        journal: { orgId: ctx.orgId, status: { notIn: ['DRAFT', 'DELETED'] } },
      },
      _sum: { debit: true, credit: true },
    }),
  ])

  const average = new Map(valued.items.map((item) => [item.itemId, item.averageCost]))
  const rows = catalog.map((item) => {
    const quantity = new Decimal(shelf.byItem[item.id]?.[id] ?? '0')
    const cost = average.get(item.id) ?? ZERO
    return {
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      quantity,
      value: quantity.times(cost),
    }
  })

  const shown = rows.filter((item) => {
    if (view === 'in') return item.quantity.greaterThan(0)
    if (view === 'zero') return item.quantity.isZero()
    if (view === 'negative') return item.quantity.isNegative()
    return true
  })

  const debit = new Decimal(balanceRow._sum.debit?.toString() ?? '0')
  const credit = new Decimal(balanceRow._sum.credit?.toString() ?? '0')

  return {
    store,
    items: shown,
    counts: {
      inStock: rows.filter((item) => item.quantity.greaterThan(0)).length,
      zero: rows.filter((item) => item.quantity.isZero()).length,
      negative: rows.filter((item) => item.quantity.isNegative()).length,
    },
    accountBalance: debit.minus(credit),
  }
}

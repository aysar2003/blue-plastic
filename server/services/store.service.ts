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

export type StoreDetailsInput = {
  name: string
  address?: string
  phone?: string
  keyHolderName?: string
  keyHolderPhone?: string
  notes?: string
}

function cleanOptional(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed : null
}

export async function list(ctx: OrgContext) {
  return db.store.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: {
      id: true,
      name: true,
      isOffice: true,
      address: true,
      phone: true,
      keyHolderName: true,
      keyHolderPhone: true,
      notes: true,
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
export async function create(ctx: OrgContext, input: string | StoreDetailsInput) {
  const details: StoreDetailsInput = typeof input === 'string' ? { name: input } : input
  const trimmed = details.name.trim()
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
    data: {
      orgId: ctx.orgId,
      name: trimmed,
      inventoryAccountId: account.id,
      address: cleanOptional(details.address),
      phone: cleanOptional(details.phone),
      keyHolderName: cleanOptional(details.keyHolderName),
      keyHolderPhone: cleanOptional(details.keyHolderPhone),
      notes: cleanOptional(details.notes),
    },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      keyHolderName: true,
      keyHolderPhone: true,
    },
  })
}

/** Update the registration details for an existing store (not the inventory account). */
export async function update(ctx: OrgContext, id: string, input: StoreDetailsInput) {
  const store = await db.store.findFirst({
    where: { id, orgId: ctx.orgId, isActive: true },
    select: { id: true, name: true },
  })
  if (!store) throw notFound('Store')

  const trimmed = input.name.trim()
  if (!trimmed) throw conflict('Give the store a name.')
  if (trimmed !== store.name) {
    const taken = await db.store.findFirst({
      where: { orgId: ctx.orgId, name: trimmed, NOT: { id } },
      select: { id: true },
    })
    if (taken) throw conflict(`A store called "${trimmed}" already exists.`)
  }

  return db.store.update({
    where: { id },
    data: {
      name: trimmed,
      address: cleanOptional(input.address),
      phone: cleanOptional(input.phone),
      keyHolderName: cleanOptional(input.keyHolderName),
      keyHolderPhone: cleanOptional(input.keyHolderPhone),
      notes: cleanOptional(input.notes),
    },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      keyHolderName: true,
      keyHolderPhone: true,
    },
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
  address: string | null
  phone: string | null
  keyHolderName: string | null
  keyHolderPhone: string | null
  inStock: number
  zero: number
  negative: number
  /** Quantity × average cost for everything in this store. */
  stockValue: Decimal
}

/** One card per store: what it holds, what is gone, and what has gone below zero. */
export async function overview(ctx: OrgContext): Promise<StoreCard[]> {
  const [shelf, items, stores, valued] = await Promise.all([
    quantities(ctx),
    db.item.findMany({
      where: { orgId: ctx.orgId, type: 'INVENTORY', deletedAt: null, isActive: true },
      select: { id: true },
    }),
    list(ctx),
    valuation(db as unknown as Tx, ctx.orgId),
  ])
  const details = new Map(stores.map((store) => [store.id, store]))
  const average = new Map(valued.items.map((item) => [item.itemId, item.averageCost]))
  return shelf.stores.map((store) => {
    let inStock = 0
    let negative = 0
    let stockValue = ZERO
    for (const item of items) {
      const qty = new Decimal(shelf.byItem[item.id]?.[store.id] ?? '0')
      const n = qty.toNumber()
      if (n < 0) negative += 1
      else if (n > 0) inStock += 1
      stockValue = stockValue.plus(qty.times(average.get(item.id) ?? ZERO))
    }
    const row = details.get(store.id)
    return {
      ...store,
      code: row?.account.code ?? '',
      accountName: row?.account.name ?? store.name,
      address: row?.address ?? null,
      phone: row?.phone ?? null,
      keyHolderName: row?.keyHolderName ?? null,
      keyHolderPhone: row?.keyHolderPhone ?? null,
      inStock,
      negative,
      zero: items.length - inStock - negative,
      stockValue,
    }
  })
}

export type StoreView = 'all' | 'in' | 'zero' | 'negative'

/** The office store id, when one exists. */
export async function officeId(ctx: OrgContext): Promise<string | null> {
  const office = await db.store.findFirst({
    where: { orgId: ctx.orgId, isActive: true, isOffice: true },
    select: { id: true },
  })
  return office?.id ?? null
}

export type StoreScope = 'store' | 'network'

export type StoreLine = {
  itemId: string
  name: string
  sku: string | null
  quantity: Decimal
  averageCost: Decimal
  value: Decimal
  /** Per-store quantities (present on network rows). */
  storeQty?: Record<string, string>
}

function filterByView<T extends { quantity: Decimal }>(rows: T[], view: StoreView): T[] {
  return rows.filter((item) => {
    if (view === 'in') return item.quantity.greaterThan(0)
    if (view === 'zero') return item.quantity.isZero()
    if (view === 'negative') return item.quantity.isNegative()
    return true
  })
}

function countByQty(rows: { quantity: Decimal }[]) {
  return {
    inStock: rows.filter((item) => item.quantity.greaterThan(0)).length,
    zero: rows.filter((item) => item.quantity.isZero()).length,
    negative: rows.filter((item) => item.quantity.isNegative()).length,
  }
}

/**
 * Totals across every store — used on the office dashboard so the main door
 * shows the whole network, not only what sits in the office itself.
 */
export async function networkTotals(ctx: OrgContext) {
  const cards = await overview(ctx)
  let inStock = 0
  let zero = 0
  let negative = 0
  let stockValue = ZERO
  for (const store of cards) {
    inStock += store.inStock
    zero += store.zero
    negative += store.negative
    stockValue = stockValue.plus(store.stockValue)
  }
  return {
    stores: cards,
    storeCount: cards.length,
    inStock,
    zero,
    negative,
    stockValue,
  }
}

/**
 * One load for the store dashboard: this store's shelf, every store's card,
 * and the item × store quantity matrix. Avoids running overview + report
 * (each of which hits quantities + valuation) on the same page.
 */
export async function dashboard(ctx: OrgContext, id: string, view: StoreView = 'all') {
  const store = await db.store.findFirst({
    where: { id, orgId: ctx.orgId, isActive: true },
    select: {
      id: true,
      name: true,
      isOffice: true,
      address: true,
      phone: true,
      keyHolderName: true,
      keyHolderPhone: true,
      notes: true,
      account: { select: { id: true, code: true, name: true } },
    },
  })
  if (!store) throw notFound('Store')

  const [shelf, catalog, valued, balanceRow, storeList] = await Promise.all([
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
    list(ctx),
  ])

  const average = new Map(valued.items.map((item) => [item.itemId, item.averageCost]))
  const details = new Map(storeList.map((row) => [row.id, row]))

  const localRows: StoreLine[] = catalog.map((item) => {
    const quantity = new Decimal(shelf.byItem[item.id]?.[id] ?? '0')
    const cost = average.get(item.id) ?? ZERO
    return {
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      quantity,
      averageCost: cost,
      value: quantity.times(cost),
    }
  })

  const matrixRows: StoreLine[] = catalog.map((item) => {
    const storeQty: Record<string, string> = {}
    let quantity = ZERO
    for (const column of shelf.stores) {
      const qty = new Decimal(shelf.byItem[item.id]?.[column.id] ?? '0')
      storeQty[column.id] = qty.toFixed(2)
      quantity = quantity.plus(qty)
    }
    const cost = average.get(item.id) ?? ZERO
    return {
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      quantity,
      averageCost: cost,
      value: quantity.times(cost),
      storeQty,
    }
  })

  const networkStores: StoreCard[] = shelf.stores.map((column) => {
    let inStock = 0
    let negative = 0
    let stockValue = ZERO
    for (const item of catalog) {
      const qty = new Decimal(shelf.byItem[item.id]?.[column.id] ?? '0')
      const n = qty.toNumber()
      if (n < 0) negative += 1
      else if (n > 0) inStock += 1
      stockValue = stockValue.plus(qty.times(average.get(item.id) ?? ZERO))
    }
    const row = details.get(column.id)
    return {
      ...column,
      code: row?.account.code ?? '',
      accountName: row?.account.name ?? column.name,
      address: row?.address ?? null,
      phone: row?.phone ?? null,
      keyHolderName: row?.keyHolderName ?? null,
      keyHolderPhone: row?.keyHolderPhone ?? null,
      inStock,
      negative,
      zero: catalog.length - inStock - negative,
      stockValue,
    }
  })

  let networkInStock = 0
  let networkZero = 0
  let networkNegative = 0
  let networkStockValue = ZERO
  for (const card of networkStores) {
    networkInStock += card.inStock
    networkZero += card.zero
    networkNegative += card.negative
    networkStockValue = networkStockValue.plus(card.stockValue)
  }

  const shownLocal = filterByView(localRows, view)
  const shownMatrix = filterByView(matrixRows, view)
  const debit = new Decimal(balanceRow._sum.debit?.toString() ?? '0')
  const credit = new Decimal(balanceRow._sum.credit?.toString() ?? '0')

  return {
    store,
    storeColumns: shelf.stores,
    items: shownLocal,
    matrix: shownMatrix,
    counts: countByQty(localRows),
    networkCounts: countByQty(matrixRows),
    stockValue: shownLocal.reduce((sum, item) => sum.plus(item.value), ZERO),
    networkStockValue: shownMatrix.reduce((sum, item) => sum.plus(item.value), ZERO),
    accountBalance: debit.minus(credit),
    network: {
      stores: networkStores,
      storeCount: networkStores.length,
      inStock: networkInStock,
      zero: networkZero,
      negative: networkNegative,
      stockValue: networkStockValue,
    },
  }
}

/** What this store is holding, including zeros and quantities below zero. */
export async function report(ctx: OrgContext, id: string, view: StoreView = 'all') {
  const board = await dashboard(ctx, id, view)
  return {
    store: board.store,
    items: board.items,
    counts: board.counts,
    stockValue: board.stockValue,
    accountBalance: board.accountBalance,
  }
}

import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'

import { Decimal, ZERO } from '@/lib/money'
import { foldStoreQuantities, type StockByStore, type StoreChoice } from '@/lib/store-stock'
import {
  generatedOfficeWording,
  OFFICE_NAME,
  officeWhere,
  officeWordingChanged,
  seedDefaultOffice,
} from '@/server/accounting/default-office'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { conflict, notFound, precondition } from '@/server/errors'
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
    description: 'Stock on hand, at weighted-average cost.',
    type: 'ASSET',
    subtype: 'INVENTORY',
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
    where: { orgId: ctx.orgId, isActive: true, ...officeWhere() },
    select: {
      id: true,
      name: true,
      isOffice: true,
      inventoryAccountId: true,
      account: { select: { id: true, name: true, description: true, detailType: true } },
    },
  })
  if (!named) return null
  if (!named.isOffice) {
    await db.store.update({ where: { id: named.id }, data: { isOffice: true } })
  }
  if (named.account.name === OFFICE_NAME) {
    const wording = generatedOfficeWording(named.account)
    if (officeWordingChanged(wording)) {
      await db.ledgerAccount.update({ where: { id: named.account.id }, data: wording })
    }
  }
  return { id: named.id, name: named.name, isOffice: true }
}

/** The office, when this company still uses that default. Null after it is removed. */
export async function ensureOffice(ctx: OrgContext): Promise<StoreColumn | null> {
  const found = await findOffice(ctx)
  if (found) return found
  const removed = await db.store.findFirst({
    where: { orgId: ctx.orgId, isActive: false, ...officeWhere() },
    select: { id: true },
  })
  if (removed) return null
  try {
    await db.$transaction((tx) => seedDefaultOffice(tx, ctx.orgId))
  } catch (error) {
    const again = await findOffice(ctx)
    if (again) return again
    const gone = await db.store.findFirst({
      where: { orgId: ctx.orgId, isActive: false, ...officeWhere() },
      select: { id: true },
    })
    if (gone) return null
    throw error
  }
  return findOffice(ctx)
}

export type OfficeDefault = {
  state: 'active' | 'removed' | 'missing'
  storeId: string | null
  account: { id: string; code: string; name: string } | null
  canRemove: boolean
  blockReason: string | null
}

async function officeUsage(tx: Tx, orgId: string, storeId: string, accountId: string) {
  const [movements, sales, purchases, items, registers, journals, tickets, transfers] = await Promise.all([
    tx.inventoryTransaction.count({ where: { orgId, storeId } }),
    tx.salesDocumentLine.count({ where: { storeId } }),
    tx.purchaseDocumentLine.count({ where: { storeId } }),
    tx.item.count({ where: { orgId, storeId, deletedAt: null } }),
    tx.posRegister.count({ where: { orgId, storeId } }),
    tx.journalLine.count({ where: { orgId, accountId } }),
    tx.storeTicket.count({ where: { orgId, OR: [{ storeId }, { toStoreId: storeId }] } }),
    tx.storeTransfer.count({ where: { orgId, OR: [{ fromStoreId: storeId }, { toStoreId: storeId }] } }),
  ])
  const parts: string[] = []
  if (movements > 0) parts.push('stock')
  if (sales > 0) parts.push('sales')
  if (purchases > 0) parts.push('purchases')
  if (items > 0) parts.push('items')
  if (registers > 0) parts.push('tills')
  if (journals > 0) parts.push('account entries')
  if (tickets > 0) parts.push('tickets')
  if (transfers > 0) parts.push('transfers')
  if (parts.length === 0) return null
  return `Xafiiska already has ${parts.join(', ')}. Move those off it before removing the default.`
}

/** What Settings → Default accounts shows for the Xafiiska default. */
export async function officeDefault(ctx: OrgContext): Promise<OfficeDefault> {
  const store = await db.store.findFirst({
    where: { orgId: ctx.orgId, ...officeWhere() },
    select: {
      id: true,
      isActive: true,
      account: { select: { id: true, code: true, name: true, description: true, detailType: true } },
    },
    orderBy: [{ isActive: 'desc' }, { isOffice: 'desc' }],
  })
  if (!store) {
    return { state: 'missing', storeId: null, account: null, canRemove: false, blockReason: null }
  }
  if (store.account.name === OFFICE_NAME) {
    const wording = generatedOfficeWording(store.account)
    if (officeWordingChanged(wording)) {
      await db.ledgerAccount.update({ where: { id: store.account.id }, data: wording })
    }
  }
  const account = { id: store.account.id, code: store.account.code, name: store.account.name }
  if (!store.isActive) {
    return {
      state: 'removed',
      storeId: store.id,
      account,
      canRemove: false,
      blockReason: null,
    }
  }
  const blockReason = await officeUsage(db as unknown as Tx, ctx.orgId, store.id, store.account.id)
  return {
    state: 'active',
    storeId: store.id,
    account,
    canRemove: blockReason == null,
    blockReason,
  }
}

/** Take Xafiiska off a company that has not used it yet. It stays off. */
export async function removeOfficeDefault(ctx: OrgContext) {
  const meta = await requestMeta()
  return db.$transaction((tx) => removeOfficeDefaultInTx(tx, ctx, meta))
}

export async function removeOfficeDefaultInTx(
  tx: Tx,
  ctx: OrgContext,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  const store = await tx.store.findFirst({
    where: { orgId: ctx.orgId, isActive: true, ...officeWhere() },
    select: {
      id: true,
      name: true,
      account: { select: { id: true, code: true, name: true } },
    },
  })
  if (!store) {
    const gone = await tx.store.findFirst({
      where: { orgId: ctx.orgId, isActive: false, ...officeWhere() },
      select: { id: true },
    })
    if (gone) throw conflict('Xafiiska is already removed.')
    throw notFound('Xafiiska')
  }
  const blockReason = await officeUsage(tx, ctx.orgId, store.id, store.account.id)
  if (blockReason) throw precondition(blockReason)

  await tx.store.update({
    where: { id: store.id },
    data: { isActive: false, isOffice: true },
  })
  await tx.ledgerAccount.update({
    where: { id: store.account.id },
    data: { isActive: false },
  })
  await writeAudit(
    tx,
    ctx,
    {
      entity: 'Store',
      entityId: store.id,
      action: 'ARCHIVE',
      before: { name: store.name, isActive: true, account: store.account },
      after: { name: OFFICE_NAME, isActive: false, removedDefault: true },
    },
    meta,
  )
  return { removed: true as const }
}

/** Put the Xafiiska default back, or create it when this company never had one. */
export async function restoreOfficeDefault(ctx: OrgContext) {
  const meta = await requestMeta()
  return db.$transaction((tx) => restoreOfficeDefaultInTx(tx, ctx, meta))
}

export async function restoreOfficeDefaultInTx(
  tx: Tx,
  ctx: OrgContext,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  const removed = await tx.store.findFirst({
    where: { orgId: ctx.orgId, isActive: false, ...officeWhere() },
    select: { id: true, inventoryAccountId: true, name: true },
  })
  if (removed) {
    await tx.store.update({
      where: { id: removed.id },
      data: { isActive: true, isOffice: true },
    })
    await tx.ledgerAccount.update({
      where: { id: removed.inventoryAccountId },
      data: { isActive: true },
    })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Store',
        entityId: removed.id,
        action: 'RESTORE',
        before: { name: removed.name, isActive: false },
        after: { name: removed.name, isActive: true, isOffice: true },
      },
      meta,
    )
    return { id: removed.id, restored: true as const }
  }

  const created = await seedDefaultOffice(tx, ctx.orgId)
  if (!created) throw conflict('Xafiiska is already the default.')
  await writeAudit(
    tx,
    ctx,
    {
      entity: 'Store',
      entityId: created.id,
      action: 'CREATE',
      after: { name: OFFICE_NAME, isOffice: true },
    },
    meta,
  )
  return { id: created.id, restored: false as const }
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
  const byItem = await cachedShelf(ctx.orgId, officeId)
  return { stores, byItem }
}

const cachedShelf = cache((orgId: string, officeId: string) =>
  unstable_cache(() => shelfQuantities(orgId, officeId), ['store-shelf-v1', orgId, officeId], {
    revalidate: 30,
  })(),
)

async function shelfQuantities(orgId: string, officeId: string): Promise<StockByStore> {
  const groups = await db.inventoryTransaction.groupBy({
    by: ['itemId', 'storeId'],
    where: {
      orgId,
      item: { isActive: true, type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] } },
    },
    _sum: { quantity: true },
  })
  return foldStoreQuantities(
    groups.map((row) => ({
      itemId: row.itemId,
      storeId: row.storeId,
      quantity: row._sum.quantity?.toString() ?? '0',
    })),
    officeId,
  )
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
  unitOfMeasure: string | null
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
      select: { id: true, name: true, sku: true, unitOfMeasure: true },
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
      unitOfMeasure: item.unitOfMeasure,
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
      unitOfMeasure: item.unitOfMeasure,
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

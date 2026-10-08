import 'server-only'
import type { Prisma } from '@prisma/client'

import { today } from '@/lib/date'
import { Decimal, parseMoneyInput } from '@/lib/money'
import { type ListQuery, paged, paginate } from '@/lib/validation/common'
import type { ItemInput } from '@/lib/validation/master-data'
import { systemAccountId } from '@/server/accounting/chart-of-accounts'
import { positionOf, positionsOf, recordMovement } from '@/server/accounting/inventory'
import { deletionStamp } from '@/server/accounting/deletion'
import { postJournal } from '@/server/accounting/posting'
import { requestMeta, writeAudit } from '@/server/audit'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { conflict, notFound, validation } from '@/server/errors'

const ITEM_SELECT = {
  id: true, sku: true, name: true, description: true, type: true, categoryId: true,
  unitOfMeasure: true,
  salesDescription: true, salesPrice: true, incomeAccountId: true, isTaxable: true, salesTaxCodeId: true,
  purchaseDescription: true, purchaseCost: true, expenseAccountId: true, purchaseTaxCodeId: true,
  inventoryAccountId: true, cogsAccountId: true, reorderPoint: true, storeId: true,
  isActive: true, availableInPos: true,
  category: { select: { id: true, name: true } },
  incomeAccount: { select: { id: true, code: true, name: true } },
  expenseAccount: { select: { id: true, code: true, name: true } },
  inventoryAccount: { select: { id: true, code: true, name: true } },
  cogsAccount: { select: { id: true, code: true, name: true } },
  store: { select: { id: true, name: true } },
  salesTaxCode: { select: { id: true, name: true } },
  purchaseTaxCode: { select: { id: true, name: true } },
} satisfies Prisma.ItemSelect

function serialise<T extends { salesPrice: unknown; purchaseCost: unknown; reorderPoint: unknown }>(item: T) {
  return {
    ...item,
    salesPrice: item.salesPrice?.toString() ?? null,
    purchaseCost: item.purchaseCost?.toString() ?? null,
    reorderPoint: item.reorderPoint?.toString() ?? null,
  }
}

/** Orderings the list screen offers. Sorting happens here, over every row. */
const ITEM_ORDER: Record<string, (dir: 'asc' | 'desc') => Prisma.ItemOrderByWithRelationInput[]> = {
  name: (dir) => [{ name: dir }],
  type: (dir) => [{ type: dir }, { name: 'asc' }],
  price: (dir) => [{ salesPrice: dir }, { name: 'asc' }],
  cost: (dir) => [{ purchaseCost: dir }, { name: 'asc' }],
  sku: (dir) => [{ sku: dir }, { name: 'asc' }],
}

export async function list(
  ctx: OrgContext,
  query: ListQuery,
  options: {
    includeInactive?: boolean
    type?: string
    categoryId?: string
    sort?: string
    dir?: 'asc' | 'desc'
  } = {},
) {
  const where: Prisma.ItemWhereInput = {
    orgId: ctx.orgId,
    ...(options.includeInactive ? {} : { isActive: true }),
    ...(options.type ? { type: options.type as Prisma.EnumItemTypeFilter['equals'] } : {}),
    ...(options.categoryId === 'none'
      ? { categoryId: null }
      : options.categoryId
        ? { categoryId: options.categoryId }
        : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { sku: { contains: query.q, mode: 'insensitive' } },
            { description: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.item.findMany({
      where,
      select: ITEM_SELECT,
      orderBy: (options.sort ? ITEM_ORDER[options.sort]?.(options.dir ?? 'asc') : undefined) ?? [
        { name: 'asc' },
      ],
      ...paginate(query),
    }),
    db.item.count({ where }),
  ])

  // Stock travels with the item, because stock *is* a property of the item —
  // not a separate register kept somewhere else. The products list shows what
  // is on hand and what it is worth, so nobody has to hold two screens in their
  // head to answer "have we got any?".
  const trackedIds = rows.filter((row) => row.type === 'INVENTORY').map((row) => row.id)
  const positions = await positionsOf(db as unknown as Tx, ctx.orgId, trackedIds)

  return paged(
    rows.map((row) => {
      const position = positions.get(row.id)
      return {
        ...serialise(row),
        onHand: position ? position.quantity.toFixed(2) : null,
        stockValue: position ? position.value.toFixed(2) : null,
        averageCost: position ? position.averageCost.toFixed(4) : null,
        belowReorder:
          position && row.reorderPoint
            ? position.quantity.lessThanOrEqualTo(row.reorderPoint.toString())
            : false,
      }
    }),
    total,
    query,
  )
}

export async function get(ctx: OrgContext, id: string) {
  const item = await db.item.findFirst({ where: { id, orgId: ctx.orgId }, select: ITEM_SELECT })
  if (!item) throw notFound('Item')
  return serialise(item)
}

export async function create(ctx: OrgContext, input: ItemInput) {
  input = await accountForStore(ctx, input)
  await assertNameAndSkuFree(ctx, input.name, input.sku ?? null)
  await assertAccountsSuitable(ctx, input)
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const item = await tx.item.create({
      data: { orgId: ctx.orgId, ...toData(input) },
      select: { id: true, name: true, type: true },
    })

    // Stock setup is part of creating an inventory item, not a separate errand
    // in another module. It posts like any other receipt: the value goes into
    // the inventory account against Opening Balance Equity, and the stock ledger
    // gets its first movement — so the item is usable the moment it exists.
    const openingQuantity = new Decimal(input.openingQuantity ?? '0')

    if (item.type === 'INVENTORY' && openingQuantity.greaterThan(0)) {
      const date = input.openingDate ?? today(ctx.organization.timeZone)

      const movement = await recordMovement(tx, ctx, {
        itemId: item.id,
        date,
        type: 'OPENING',
        sourceType: 'OPENING_BALANCE',
        sourceId: item.id,
        quantity: openingQuantity,
        unitCost: input.openingUnitCost ?? '0',
        storeId: input.storeId ?? null,
      })

      if (!movement.value.isZero()) {
        const journal = await postJournal(tx, ctx, {
          date,
          memo: `Opening stock — ${item.name}`,
          sourceType: 'OPENING_BALANCE',
          sourceId: item.id,
          lines: [
            {
              accountId: input.inventoryAccountId!,
              debit: movement.value,
              description: `${openingQuantity.toFixed(2)} × ${movement.unitCost.toFixed(4)}`,
            },
            {
              accountId: await systemAccountId(tx, ctx.orgId, 'OPENING_BALANCE_EQUITY'),
              credit: movement.value,
              description: `Opening stock — ${item.name}`,
            },
          ],
        })

        await tx.inventoryTransaction.updateMany({
          where: { orgId: ctx.orgId, itemId: item.id, journalId: null },
          data: { journalId: journal.id },
        })
      }
    }

    await writeAudit(tx, ctx, { entity: 'Item', entityId: item.id, action: 'CREATE', after: item }, meta)
    return item
  })
}

export async function update(ctx: OrgContext, input: ItemInput & { id: string }) {
  const patched = await accountForStore(ctx, input, input.id)
  input = { ...input, ...patched, id: input.id }
  const before = await db.item.findFirst({ where: { id: input.id, orgId: ctx.orgId }, select: ITEM_SELECT })
  if (!before) throw notFound('Item')

  await assertNameAndSkuFree(ctx, input.name, input.sku ?? null, input.id)
  await assertAccountsSuitable(ctx, input)

  // Changing what an item *is* would reclassify everything already sold through
  // it, so the type is fixed once the item exists.
  if (before.type !== input.type) {
    throw validation(
      `An item's type cannot be changed after it is created — it would reclassify every document that already used it. Create a new item instead.`,
      { type: ['Type cannot be changed'] },
    )
  }

  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const after = await tx.item.update({
      where: { id: input.id },
      data: toData(input),
      select: { id: true, name: true, type: true },
    })

    await writeAudit(
      tx,
      ctx,
      { entity: 'Item', entityId: after.id, action: 'UPDATE', before: serialise(before), after },
      meta,
    )
    return after
  })
}

/**
 * The quantity at which this product should be ordered again.
 * Blank clears the limit. It does not move stock or post a journal.
 */
export async function setReorderPoint(ctx: OrgContext, id: string, raw: string) {
  const before = await db.item.findFirst({
    where: { id, orgId: ctx.orgId, deletedAt: null, type: 'INVENTORY' },
    select: { id: true, name: true, reorderPoint: true },
  })
  if (!before) throw notFound('Item')

  const trimmed = raw.trim()
  let next: string | null = null
  if (trimmed) {
    const parsed = parseMoneyInput(trimmed)
    if (!parsed || parsed.isNegative()) {
      throw validation('The reorder limit has to be zero or more.', {
        reorderPoint: ['Enter a number'],
      })
    }
    next = parsed.toFixed(4)
  }

  const meta = await requestMeta()
  await db.$transaction(async (tx) => {
    await tx.item.update({ where: { id }, data: { reorderPoint: next } })
    await writeAudit(
      tx,
      ctx,
      {
        entity: 'Item',
        entityId: id,
        action: 'UPDATE',
        before: { reorderPoint: before.reorderPoint?.toString() ?? null },
        after: { reorderPoint: next },
      },
      meta,
    )
  })

  return { id, name: before.name, reorderPoint: next }
}

export async function setActive(ctx: OrgContext, ids: string[], isActive: boolean) {
  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const result = await tx.item.updateMany({
      where: { id: { in: ids }, orgId: ctx.orgId },
      data: { isActive },
    })

    for (const id of ids) {
      await writeAudit(
        tx,
        ctx,
        { entity: 'Item', entityId: id, action: isActive ? 'RESTORE' : 'ARCHIVE', after: { isActive } },
        meta,
      )
    }

    return { count: result.count }
  })
}

/**
 * Delete an item.
 *
 * It leaves every list, every picker and every report. The row stays, because
 * the documents that already name it — an invoice from March, a bill from last
 * year — still have to read correctly, and a line pointing at nothing is not a
 * correct document. Nothing about those documents changes; the item is simply no
 * longer offered or listed anywhere.
 *
 * Stock is the one thing that has to be dealt with rather than hidden. An item
 * deleted while holding stock would leave value in the Inventory Asset account
 * belonging to something that no longer appears on the valuation report, so the
 * stock is written off first, through the ordinary shrinkage account, in a
 * journal that says what it was for.
 */
export async function remove(ctx: OrgContext, id: string, reason?: string | null) {
  return db.$transaction(async (tx) => {
    const item = await tx.item.findFirst({
      where: { id, orgId: ctx.orgId, deletedAt: undefined },
      select: { id: true, name: true, sku: true, type: true, deletedAt: true },
    })
    if (!item) throw notFound('Item')
    if (item.deletedAt) return { id, name: item.name }

    if (item.type === 'INVENTORY') {
      await writeOffRemainingStock(tx, ctx, id, item.name, reason)
    }

    await tx.item.update({ where: { id }, data: deletionStamp(ctx, reason) })

    await writeAudit(tx, ctx, {
      entity: 'Item',
      entityId: id,
      action: 'DELETE',
      before: { name: item.name, sku: item.sku, type: item.type },
      after: { deleted: true, reason: reason?.trim() || null },
    })

    return { id, name: item.name }
  })
}

/**
 * Take a deleted item's remaining stock out of the books.
 *
 * Not silently: it is a movement in the stock ledger and a journal against
 * inventory shrinkage, exactly as a write-off entered by hand would be, so the
 * Inventory Asset account and the stock ledger still agree afterwards and the
 * loss appears in the profit and loss where a loss belongs.
 */
async function writeOffRemainingStock(
  tx: Tx,
  ctx: OrgContext,
  itemId: string,
  itemName: string,
  reason?: string | null,
): Promise<void> {
  const position = await positionOf(tx, itemId)
  if (position.quantity.isZero() && position.value.isZero()) return

  const date = today(ctx.organization.timeZone)
  const memo = `Stock written off — "${itemName}" deleted${reason?.trim() ? ` (${reason.trim()})` : ''}`

  const movement = await recordMovement(tx, ctx, {
    itemId,
    date,
    type: 'ADJUSTMENT',
    sourceType: 'MANUAL',
    sourceId: itemId,
    quantity: position.quantity.negated().toString(),
  })

  const [inventoryAccountId, shrinkageAccountId] = await Promise.all([
    systemAccountId(tx, ctx.orgId, 'INVENTORY_ASSET'),
    systemAccountId(tx, ctx.orgId, 'INVENTORY_SHRINKAGE'),
  ])

  const value = movement.value.abs()
  if (value.isZero()) return

  await postJournal(tx, ctx, {
    date,
    memo,
    sourceType: 'MANUAL',
    lines: [
      { accountId: shrinkageAccountId, debit: value },
      { accountId: inventoryAccountId, credit: value },
    ],
  })
}

export async function listCategories(ctx: OrgContext) {
  return db.itemCategory.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    select: { id: true, name: true, parentId: true },
    orderBy: { name: 'asc' },
  })
}

/**
 * Ensure the international standard catalogue groups exist for this organisation.
 * Idempotent — skips names that are already present (any casing).
 */
export async function ensureStandardCategories(ctx: OrgContext) {
  const { STANDARD_ITEM_CATEGORIES } = await import('@/lib/standard-categories')
  const existing = await db.itemCategory.findMany({
    where: { orgId: ctx.orgId },
    select: { name: true },
  })
  const have = new Set(existing.map((row) => row.name.toLowerCase()))
  const missing = STANDARD_ITEM_CATEGORIES.filter((name) => !have.has(name.toLowerCase()))
  if (missing.length === 0) return listCategories(ctx)

  await db.itemCategory.createMany({
    data: missing.map((name) => ({ orgId: ctx.orgId, name })),
    skipDuplicates: true,
  })
  return listCategories(ctx)
}

/** Category cards for the catalogue hub: item counts and on-hand value. */
export async function categoryDashboard(ctx: OrgContext) {
  const categories = await ensureStandardCategories(ctx)
  const counts = await db.item.groupBy({
    by: ['categoryId'],
    where: { orgId: ctx.orgId, isActive: true },
    _count: { _all: true },
  })
  const byCategory = new Map(counts.map((row) => [row.categoryId ?? 'none', row._count._all]))
  return categories.map((category) => ({
    ...category,
    itemCount: byCategory.get(category.id) ?? 0,
  }))
}

export async function getCategory(ctx: OrgContext, id: string) {
  const category = await db.itemCategory.findFirst({
    where: { id, orgId: ctx.orgId, isActive: true },
    select: { id: true, name: true, parentId: true },
  })
  if (!category) throw notFound('Category')
  return category
}

/** Create a product category from the item form when one is missing. */
export async function createCategory(ctx: OrgContext, name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw validation('Category name is required.', { name: ['Required'] })

  const existing = await db.itemCategory.findFirst({
    where: { orgId: ctx.orgId, name: { equals: trimmed, mode: 'insensitive' } },
    select: { id: true, name: true, isActive: true },
  })
  if (existing) {
    if (!existing.isActive) {
      const restored = await db.itemCategory.update({
        where: { id: existing.id },
        data: { isActive: true, name: trimmed },
        select: { id: true, name: true },
      })
      return restored
    }
    throw conflict(`A category called "${existing.name}" already exists.`)
  }

  return db.itemCategory.create({
    data: { orgId: ctx.orgId, name: trimmed },
    select: { id: true, name: true },
  })
}

function toData(input: ItemInput) {
  return {
    sku: input.sku ?? null,
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    categoryId: input.categoryId ?? null,
    unitOfMeasure: input.unitOfMeasure ?? null,
    salesDescription: input.salesDescription ?? null,
    salesPrice: input.salesPrice ?? null,
    incomeAccountId: input.incomeAccountId ?? null,
    isTaxable: input.isTaxable,
    salesTaxCodeId: input.salesTaxCodeId ?? null,
    purchaseDescription: input.purchaseDescription ?? null,
    purchaseCost: input.purchaseCost ?? null,
    expenseAccountId: input.expenseAccountId ?? null,
    purchaseTaxCodeId: input.purchaseTaxCodeId ?? null,
    inventoryAccountId: input.inventoryAccountId ?? null,
    cogsAccountId: input.cogsAccountId ?? null,
    reorderPoint: input.reorderPoint ?? null,
    storeId: input.type === 'INVENTORY' ? (input.storeId ?? null) : null,
    availableInPos: input.availableInPos,
  }
}

/**
 * A new item in a store posts to that store's inventory account.
 * An item that already has stock keeps the account that holds its value,
 * and the store is only where the report says it sits.
 */
async function accountForStore(ctx: OrgContext, input: ItemInput, itemId?: string): Promise<ItemInput> {
  if (input.type !== 'INVENTORY' || !input.storeId) return input
  const store = await db.store.findFirst({
    where: { id: input.storeId, orgId: ctx.orgId, isActive: true },
    select: { inventoryAccountId: true },
  })
  if (!store) throw notFound('Store')
  if (itemId) {
    const moved = await db.inventoryTransaction.count({ where: { orgId: ctx.orgId, itemId } })
    if (moved > 0) return input
  }
  return { ...input, inventoryAccountId: store.inventoryAccountId }
}

async function assertNameAndSkuFree(ctx: OrgContext, name: string, sku: string | null, selfId?: string) {
  const byName = await db.item.findUnique({
    where: { orgId_name: { orgId: ctx.orgId, name } },
    select: { id: true },
  })
  if (byName && byName.id !== selfId) {
    throw conflict(`Another item is already called "${name}".`)
  }

  if (sku) {
    const bySku = await db.item.findUnique({
      where: { orgId_sku: { orgId: ctx.orgId, sku } },
      select: { id: true, name: true },
    })
    if (bySku && bySku.id !== selfId) {
      throw validation(`SKU "${sku}" already belongs to "${bySku.name}".`, {
        sku: [`Already used by "${bySku.name}"`],
      })
    }
  }
}

/**
 * The database enforces this too. Doing it here first is what turns
 * "check_violation on trg_item_account_mapping" into a sentence that names the
 * field and says why.
 */
async function assertAccountsSuitable(ctx: OrgContext, input: ItemInput) {
  const ids = [
    input.incomeAccountId,
    input.expenseAccountId,
    input.inventoryAccountId,
    input.cogsAccountId,
  ].filter(Boolean) as string[]

  if (ids.length === 0) return

  const accounts = await db.ledgerAccount.findMany({
    where: { id: { in: ids }, orgId: ctx.orgId },
    select: { id: true, name: true, type: true, subtype: true, isActive: true },
  })
  const byId = new Map(accounts.map((a) => [a.id, a]))

  for (const id of ids) {
    const account = byId.get(id)
    if (!account) throw notFound('Account')
    if (!account.isActive) {
      throw validation(`"${account.name}" is archived and cannot be used for posting.`)
    }
  }

  const income = input.incomeAccountId ? byId.get(input.incomeAccountId) : null
  if (income && income.type !== 'REVENUE') {
    throw validation(`"${income.name}" is not an income account, so sales cannot be posted to it.`, {
      incomeAccountId: ['Choose an income account'],
    })
  }

  const expense = input.expenseAccountId ? byId.get(input.expenseAccountId) : null
  if (expense && expense.type !== 'EXPENSE') {
    throw validation(`"${expense.name}" is not an expense account.`, {
      expenseAccountId: ['Choose an expense account'],
    })
  }

  const cogs = input.cogsAccountId ? byId.get(input.cogsAccountId) : null
  if (cogs && cogs.type !== 'EXPENSE') {
    throw validation(`"${cogs.name}" is not an expense account, so cost of sales cannot be posted to it.`, {
      cogsAccountId: ['Choose an expense account'],
    })
  }

  const inventory = input.inventoryAccountId ? byId.get(input.inventoryAccountId) : null
  if (inventory && inventory.subtype !== 'INVENTORY') {
    throw validation(`"${inventory.name}" is not an inventory account, so stock value cannot be held in it.`, {
      inventoryAccountId: ['Choose an inventory account'],
    })
  }
}

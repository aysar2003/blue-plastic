import 'server-only'
import type { Prisma } from '@prisma/client'

import { today } from '@/lib/date'
import {
  isStockTracked,
  skipsIncomeAccount,
  usesCogsCost,
  usesOperatingExpense,
} from '@/lib/item-types'
import { Decimal, parseMoneyInput, ZERO } from '@/lib/money'
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
  id: true, sku: true, barcode: true, name: true, description: true, type: true, categoryId: true,
  unitOfMeasure: true,
  salesDescription: true, salesPrice: true, incomeAccountId: true, isTaxable: true, salesTaxCodeId: true,
  purchaseDescription: true, purchaseCost: true, expenseAccountId: true, purchaseTaxCodeId: true,
  inventoryAccountId: true, cogsAccountId: true, reorderPoint: true, storeId: true,
  isActive: true, availableInPos: true,
  printGroupItems: true, itemPaymentMethod: true, depositAccountId: true,
  category: { select: { id: true, name: true } },
  incomeAccount: { select: { id: true, code: true, name: true } },
  expenseAccount: { select: { id: true, code: true, name: true } },
  inventoryAccount: { select: { id: true, code: true, name: true } },
  cogsAccount: { select: { id: true, code: true, name: true } },
  depositAccount: { select: { id: true, code: true, name: true } },
  store: { select: { id: true, name: true } },
  salesTaxCode: { select: { id: true, name: true } },
  purchaseTaxCode: { select: { id: true, name: true } },
  bomChildren: {
    select: { componentItemId: true, quantity: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.ItemSelect

function serialise<
  T extends {
    salesPrice: unknown
    purchaseCost: unknown
    reorderPoint: unknown
    bomChildren?: { componentItemId: string; quantity: unknown; sortOrder: number }[]
  },
>(item: T) {
  const { bomChildren, ...rest } = item
  return {
    ...rest,
    salesPrice: item.salesPrice?.toString() ?? null,
    purchaseCost: item.purchaseCost?.toString() ?? null,
    reorderPoint: item.reorderPoint?.toString() ?? null,
    components: (bomChildren ?? []).map((row) => ({
      itemId: row.componentItemId,
      quantity: String(row.quantity),
    })),
  }
}

/** Orderings the list screen offers. Sorting happens here, over every row. */
const ITEM_ORDER: Record<string, (dir: 'asc' | 'desc') => Prisma.ItemOrderByWithRelationInput[]> = {
  name: (dir) => [{ name: dir }],
  type: (dir) => [{ type: dir }, { name: 'asc' }],
  price: (dir) => [{ salesPrice: dir }, { name: 'asc' }],
  cost: (dir) => [{ purchaseCost: dir }, { name: 'asc' }],
  sku: (dir) => [{ sku: dir }, { name: 'asc' }],
  barcode: (dir) => [{ barcode: dir }, { name: 'asc' }],
  category: (dir) => [{ category: { name: dir } }, { name: 'asc' }],
  salesDescription: (dir) => [{ salesDescription: dir }, { name: 'asc' }],
  purchaseDescription: (dir) => [{ purchaseDescription: dir }, { name: 'asc' }],
  reorderPoint: (dir) => [{ reorderPoint: dir }, { name: 'asc' }],
  unitOfMeasure: (dir) => [{ unitOfMeasure: dir }, { name: 'asc' }],
  store: (dir) => [{ store: { name: dir } }, { name: 'asc' }],
  incomeAccount: (dir) => [{ incomeAccount: { code: dir } }, { name: 'asc' }],
  inventoryAccount: (dir) => [{ inventoryAccount: { code: dir } }, { name: 'asc' }],
  cogsExpense: (dir) => [{ cogsAccount: { code: dir } }, { expenseAccount: { code: dir } }, { name: 'asc' }],
}

/** Sort keys that need stock figures first (then page). */
const STOCK_SORTS = new Set(['onHand', 'stockValue'])

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
            { barcode: { contains: query.q, mode: 'insensitive' } },
            { description: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const total = await db.item.count({ where })
  const dir = options.dir ?? 'asc'
  const sortKey = options.sort && (ITEM_ORDER[options.sort] || STOCK_SORTS.has(options.sort))
    ? options.sort
    : undefined

  // On hand / stock value live in the inventory ledger, not on the item row —
  // same idea as sorting customers by open balance.
  if (sortKey && STOCK_SORTS.has(sortKey)) {
    const people = await db.item.findMany({
      where,
      select: { id: true, type: true },
    })
    const trackedIds = people.filter((row) => isStockTracked(row.type)).map((row) => row.id)
    const positions = await positionsOf(db as unknown as Tx, ctx.orgId, trackedIds)
    const direction = dir === 'desc' ? -1 : 1
    const ordered = people
      .map((row) => {
        const position = positions.get(row.id)
        const value =
          sortKey === 'stockValue' ? (position?.value ?? ZERO) : (position?.quantity ?? ZERO)
        return { id: row.id, value }
      })
      .sort((a, b) => a.value.comparedTo(b.value) * direction)
    const { skip, take } = paginate(query)
    const slice = ordered.slice(skip, skip + take)
    const found = slice.length
      ? await db.item.findMany({
          where: { id: { in: slice.map((row) => row.id) } },
          select: ITEM_SELECT,
        })
      : []
    const byId = new Map(found.map((row) => [row.id, row]))
    const rows = slice.map((entry) => byId.get(entry.id)!).filter(Boolean)
    const pagePositions = await positionsOf(
      db as unknown as Tx,
      ctx.orgId,
      rows.filter((row) => isStockTracked(row.type)).map((row) => row.id),
    )
    const locked = await typeLockedItemIds(
      ctx,
      rows.map((row) => row.id),
    )
    return paged(
      rows.map((row) => ({
        ...attachStock(row, pagePositions.get(row.id)),
        typeEditable: !locked.has(row.id),
      })),
      total,
      query,
    )
  }

  const rows = await db.item.findMany({
    where,
    select: ITEM_SELECT,
    orderBy: (sortKey ? ITEM_ORDER[sortKey]?.(dir) : undefined) ?? [{ name: 'asc' }],
    ...paginate(query),
  })

  // Stock travels with the item, because stock *is* a property of the item —
  // not a separate register kept somewhere else. The products list shows what
  // is on hand and what it is worth, so nobody has to hold two screens in their
  // head to answer "have we got any?".
  const trackedIds = rows.filter((row) => isStockTracked(row.type)).map((row) => row.id)
  const [positions, locked] = await Promise.all([
    positionsOf(db as unknown as Tx, ctx.orgId, trackedIds),
    typeLockedItemIds(
      ctx,
      rows.map((row) => row.id),
    ),
  ])

  return paged(
    rows.map((row) => ({
      ...attachStock(row, positions.get(row.id)),
      typeEditable: !locked.has(row.id),
    })),
    total,
    query,
  )
}

function attachStock<
  T extends {
    type: string
    reorderPoint: unknown
    salesPrice: unknown
    purchaseCost: unknown
  },
>(
  row: T,
  position:
    | { quantity: Decimal; value: Decimal; averageCost: Decimal }
    | undefined,
) {
  return {
    ...serialise(row),
    onHand: position ? position.quantity.toFixed(2) : null,
    stockValue: position ? position.value.toFixed(2) : null,
    averageCost: position ? position.averageCost.toFixed(4) : null,
    belowReorder:
      position && row.reorderPoint
        ? position.quantity.lessThanOrEqualTo(String(row.reorderPoint))
        : false,
  }
}

export async function get(ctx: OrgContext, id: string) {
  const item = await db.item.findFirst({ where: { id, orgId: ctx.orgId }, select: ITEM_SELECT })
  if (!item) throw notFound('Item')
  const locked = await typeLockedItemIds(ctx, [id])
  return { ...serialise(item), typeEditable: !locked.has(id) }
}

/**
 * Items that already appear on a sales/purchase document, stock movement,
 * adjustment, transfer, ticket, or delivery note. Their type is fixed.
 */
export async function typeLockedItemIds(ctx: OrgContext, itemIds: string[]): Promise<Set<string>> {
  if (itemIds.length === 0) return new Set()

  const onItem = { orgId: ctx.orgId, itemId: { in: itemIds } }
  const [sales, purchases, movements, adjustments, transfers, tickets, deliveries] = await Promise.all([
    db.salesDocumentLine.findMany({ where: onItem, select: { itemId: true }, distinct: ['itemId'] }),
    db.purchaseDocumentLine.findMany({ where: onItem, select: { itemId: true }, distinct: ['itemId'] }),
    db.inventoryTransaction.findMany({ where: onItem, select: { itemId: true }, distinct: ['itemId'] }),
    db.inventoryAdjustmentLine.findMany({ where: onItem, select: { itemId: true }, distinct: ['itemId'] }),
    db.storeTransfer.findMany({ where: onItem, select: { itemId: true }, distinct: ['itemId'] }),
    db.storeTicket.findMany({ where: onItem, select: { itemId: true }, distinct: ['itemId'] }),
    db.deliveryNoteLine.findMany({
      where: { orgId: ctx.orgId, itemId: { in: itemIds } },
      select: { itemId: true },
      distinct: ['itemId'],
    }),
  ])

  const locked = new Set<string>()
  for (const row of [
    ...sales,
    ...purchases,
    ...movements,
    ...adjustments,
    ...transfers,
    ...tickets,
    ...deliveries,
  ]) {
    if (row.itemId) locked.add(row.itemId)
  }
  return locked
}

export async function create(ctx: OrgContext, input: ItemInput) {
  input = await accountForStore(ctx, input)
  input = await assignProductCostAccount(ctx, input)
  if (!ctx.features.enableTax) {
    input = { ...input, salesTaxCodeId: null, purchaseTaxCodeId: null, isTaxable: false }
  }
  await assertNameAndSkuFree(ctx, input.name, input.sku ?? null, input.barcode ?? null)
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

    if (isStockTracked(item.type) && openingQuantity.greaterThan(0)) {
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

    await saveComponents(tx, ctx, item.id, item.type, input.componentsJson)
    await writeAudit(tx, ctx, { entity: 'Item', entityId: item.id, action: 'CREATE', after: item }, meta)
    return item
  })
}

export async function update(ctx: OrgContext, input: ItemInput & { id: string }) {
  const patched = await accountForStore(ctx, input, input.id)
  const assigned = await assignProductCostAccount(ctx, { ...input, ...patched })
  input = { ...assigned, id: input.id }
  if (!ctx.features.enableTax) {
    input = { ...input, salesTaxCodeId: null, purchaseTaxCodeId: null, isTaxable: false }
  }
  const before = await db.item.findFirst({ where: { id: input.id, orgId: ctx.orgId }, select: ITEM_SELECT })
  if (!before) throw notFound('Item')

  await assertNameAndSkuFree(ctx, input.name, input.sku ?? null, input.barcode ?? null, input.id)
  await assertAccountsSuitable(ctx, input)

  // Type may change only while the item has never appeared on a document or in
  // the stock/journal ledgers. Once it has, every past line would be reclassified.
  if (before.type !== input.type) {
    const locked = await typeLockedItemIds(ctx, [input.id])
    if (locked.has(input.id)) {
      throw validation(
        `This item's type cannot change — it already appears on a document or journal. Create a new item instead.`,
        { type: ['Type cannot be changed'] },
      )
    }
  }

  const meta = await requestMeta()

  return db.$transaction(async (tx) => {
    const after = await tx.item.update({
      where: { id: input.id },
      data: toData(input),
      select: { id: true, name: true, type: true },
    })

    await saveComponents(tx, ctx, after.id, after.type, input.componentsJson)

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
    where: { id, orgId: ctx.orgId, deletedAt: null, type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] } },
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

    if (isStockTracked(item.type)) {
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

/** Standard catalogue groups this organisation does not have yet (any casing). */
export async function missingStandardCategories(ctx: OrgContext): Promise<string[]> {
  const { STANDARD_ITEM_CATEGORIES } = await import('@/lib/standard-categories')
  const existing = await db.itemCategory.findMany({
    where: { orgId: ctx.orgId },
    select: { name: true },
  })
  const have = new Set(existing.map((row) => row.name.toLowerCase()))
  return STANDARD_ITEM_CATEGORIES.filter((name) => !have.has(name.toLowerCase()))
}

/**
 * Add the international standard catalogue groups for this organisation.
 * Idempotent — skips names that are already present (any casing). Run from an
 * explicit action, never from a page render: reading a list must not write.
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

/** Category cards for the catalogue hub: item counts per category. Read-only. */
export async function categoryDashboard(ctx: OrgContext) {
  const categories = await listCategories(ctx)
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

/**
 * Products and tracked stock do not pick an expense account.
 * Their cost posts to the system Cost of Goods Sold account — sales price on
 * one side, that account's cost on the other.
 */
async function assignProductCostAccount(ctx: OrgContext, input: ItemInput): Promise<ItemInput> {
  if (skipsIncomeAccount(input.type)) {
    return {
      ...input,
      incomeAccountId: null,
      expenseAccountId: null,
      inventoryAccountId: null,
      cogsAccountId: null,
      storeId: null,
    }
  }

  if (usesOperatingExpense(input.type) || input.type === 'DISCOUNT') {
    return { ...input, inventoryAccountId: null, cogsAccountId: null }
  }

  if (!usesCogsCost(input.type)) {
    return { ...input, inventoryAccountId: null, cogsAccountId: null, expenseAccountId: null }
  }

  const account = await db.ledgerAccount.findUnique({
    where: { orgId_systemKey: { orgId: ctx.orgId, systemKey: 'COGS' } },
    select: { id: true },
  })
  if (!account) {
    throw validation('There is no Cost of Goods Sold account on the chart, so a product cannot be saved.', {
      cogsAccountId: ['Set up the Cost of Goods Sold account'],
    })
  }

  if (isStockTracked(input.type)) {
    return { ...input, cogsAccountId: account.id, expenseAccountId: null }
  }

  return {
    ...input,
    expenseAccountId: account.id,
    cogsAccountId: null,
    inventoryAccountId: null,
  }
}

function toData(input: ItemInput) {
  return {
    sku: input.sku ?? null,
    barcode: input.barcode ?? null,
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
    storeId: isStockTracked(input.type) ? (input.storeId ?? null) : null,
    availableInPos: input.type === 'PAYMENT' || input.type === 'SUBTOTAL' || input.type === 'GROUP'
      ? false
      : input.availableInPos,
    printGroupItems: input.type === 'GROUP' ? (input.printGroupItems ?? true) : true,
    itemPaymentMethod: input.type === 'PAYMENT' ? (input.itemPaymentMethod ?? 'CASH') : null,
    depositAccountId: input.type === 'PAYMENT' ? (input.depositAccountId ?? null) : null,
  }
}

function parseComponents(raw: string | null | undefined): { itemId: string; quantity: string }[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row) => {
        if (!row || typeof row !== 'object') return null
        const itemId = String((row as { itemId?: unknown }).itemId ?? '')
        const quantity = String((row as { quantity?: unknown }).quantity ?? '1')
        if (!itemId) return null
        return { itemId, quantity }
      })
      .filter((row): row is { itemId: string; quantity: string } => Boolean(row))
  } catch {
    return []
  }
}

async function saveComponents(
  tx: Tx,
  ctx: OrgContext,
  parentItemId: string,
  type: ItemInput['type'],
  raw: string | null | undefined,
) {
  if (type !== 'GROUP' && type !== 'INVENTORY_ASSEMBLY') {
    await tx.itemComponent.deleteMany({ where: { parentItemId, orgId: ctx.orgId } })
    return
  }
  const rows = parseComponents(raw)
  await tx.itemComponent.deleteMany({ where: { parentItemId, orgId: ctx.orgId } })
  const blocked = new Set(['GROUP', 'SUBTOTAL', 'PAYMENT'])
  for (const [index, row] of rows.entries()) {
    const qty = parseMoneyInput(row.quantity)
    if (!qty || qty.lessThanOrEqualTo(0)) continue
    const child = await tx.item.findFirst({
      where: { id: row.itemId, orgId: ctx.orgId, deletedAt: null, isActive: true },
      select: { id: true, name: true, type: true },
    })
    if (!child || child.id === parentItemId) continue
    if (blocked.has(child.type)) {
      throw validation(
        `"${child.name}" cannot be a group member (${child.type.toLowerCase().replaceAll('_', ' ')}).`,
        { componentsJson: ['Choose inventory, non-inventory, service, other charge, or discount items'] },
      )
    }
    await tx.itemComponent.create({
      data: {
        orgId: ctx.orgId,
        parentItemId,
        componentItemId: child.id,
        quantity: qty,
        sortOrder: index,
      },
    })
  }
}

/**
 * A new item in a store posts to that store's inventory account.
 * An item that already has stock keeps the account that holds its value,
 * and the store is only where the report says it sits.
 */
async function accountForStore(ctx: OrgContext, input: ItemInput, itemId?: string): Promise<ItemInput> {
  if (!isStockTracked(input.type) || !input.storeId) return input
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

async function assertNameAndSkuFree(
  ctx: OrgContext,
  name: string,
  sku: string | null,
  barcode: string | null,
  selfId?: string,
) {
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

  if (barcode) {
    const byBarcode = await db.item.findFirst({
      where: {
        orgId: ctx.orgId,
        barcode: { equals: barcode, mode: 'insensitive' },
        ...(selfId ? { NOT: { id: selfId } } : {}),
      },
      select: { id: true, name: true },
    })
    if (byBarcode) {
      throw validation(`Barcode "${barcode}" already belongs to "${byBarcode.name}".`, {
        barcode: [`Already used by "${byBarcode.name}"`],
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
    input.depositAccountId,
  ].filter(Boolean) as string[]

  if (ids.length === 0) return

  const accounts = await db.ledgerAccount.findMany({
    where: { id: { in: ids }, orgId: ctx.orgId },
    select: { id: true, name: true, type: true, subtype: true, systemKey: true, isActive: true },
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
  if (income) {
    if (input.type === 'DISCOUNT') {
      // Contra-income (sales discounts) or a dedicated discount expense account.
      if (income.type !== 'REVENUE' && income.type !== 'EXPENSE') {
        throw validation(
          `"${income.name}" is not an income or expense account, so this discount cannot post to it.`,
          { incomeAccountId: ['Choose an income or expense account'] },
        )
      }
    } else if (income.type !== 'REVENUE') {
      throw validation(`"${income.name}" is not an income account, so sales cannot be posted to it.`, {
        incomeAccountId: ['Choose an income account'],
      })
    }
  }

  const expense = input.expenseAccountId ? byId.get(input.expenseAccountId) : null
  const serviceLike = input.type === 'SERVICE' || input.type === 'OTHER_CHARGE'
  if (expense && serviceLike && expense.type !== 'EXPENSE') {
    throw validation(`"${expense.name}" is not an expense account.`, {
      expenseAccountId: ['Choose an expense account'],
    })
  }
  if (expense && !serviceLike && expense.type !== 'COGS') {
    throw validation(`"${expense.name}" is not a cost of goods sold account.`, {
      expenseAccountId: ['Use Cost of Goods Sold'],
    })
  }

  const cogs = input.cogsAccountId ? byId.get(input.cogsAccountId) : null
  if (cogs && cogs.type !== 'COGS') {
    throw validation(`"${cogs.name}" is not a cost of goods sold account, so cost of sales cannot be posted to it.`, {
      cogsAccountId: ['Choose a cost of goods sold account'],
    })
  }

  const inventory = input.inventoryAccountId ? byId.get(input.inventoryAccountId) : null
  if (inventory && inventory.subtype !== 'INVENTORY') {
    throw validation(`"${inventory.name}" is not an inventory account, so stock value cannot be held in it.`, {
      inventoryAccountId: ['Choose an inventory account'],
    })
  }

  const deposit = input.depositAccountId ? byId.get(input.depositAccountId) : null
  if (deposit) {
    const ok =
      deposit.type === 'ASSET' &&
      (deposit.subtype === 'BANK' || deposit.subtype === 'UNDEPOSITED_FUNDS')
    if (!ok) {
      throw validation(
        `"${deposit.name}" is not a bank or Undeposited Funds account.`,
        { depositAccountId: ['Choose Undeposited Funds or a bank account'] },
      )
    }
  }
}

/** Catalog for GROUP / Assembly component pickers (every sellable child type). */
export async function listCatalog(ctx: OrgContext) {
  const rows = await db.item.findMany({
    where: {
      orgId: ctx.orgId,
      deletedAt: null,
      isActive: true,
      type: { notIn: ['GROUP', 'SUBTOTAL', 'PAYMENT'] },
    },
    select: { id: true, name: true, sku: true, type: true },
    orderBy: { name: 'asc' },
  })
  return rows.map((row) => ({
    id: row.id,
    label: row.sku ? `${row.name} (${row.sku})` : row.name,
    type: row.type,
  }))
}

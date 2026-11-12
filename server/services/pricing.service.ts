import 'server-only'

import { Decimal } from '@/lib/money'
import { toDate, today } from '@/lib/date'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, validation } from '@/server/errors'

export async function listPriceLists(ctx: OrgContext) {
  return db.priceList.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    include: {
      items: {
        include: { item: { select: { id: true, name: true, sku: true } } },
        take: 500,
      },
      _count: { select: { customers: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function upsertPriceList(
  ctx: OrgContext,
  input: {
    id?: string
    name: string
    lines?: { itemId: string; unitPrice: string }[]
  },
) {
  const name = input.name.trim()
  if (!name) throw validation('Price list name is required.')

  if (input.id) {
    const existing = await db.priceList.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Price list')
    await db.priceList.update({ where: { id: existing.id }, data: { name } })
    if (input.lines) {
      await replacePriceListItems(ctx, existing.id, input.lines)
    }
    return existing
  }

  try {
    const created = await db.priceList.create({
      data: { orgId: ctx.orgId, name },
    })
    if (input.lines?.length) {
      await replacePriceListItems(ctx, created.id, input.lines)
    }
    return created
  } catch {
    throw conflict('Another price list already uses that name.')
  }
}

async function replacePriceListItems(
  ctx: OrgContext,
  priceListId: string,
  lines: { itemId: string; unitPrice: string }[],
) {
  const itemIds = [...new Set(lines.map((line) => line.itemId))]
  const known = await db.item.findMany({
    where: { orgId: ctx.orgId, id: { in: itemIds }, deletedAt: null },
    select: { id: true },
  })
  if (known.length !== itemIds.length) throw notFound('Item')

  await db.$transaction(async (tx) => {
    await tx.priceListItem.deleteMany({ where: { priceListId } })
    if (lines.length === 0) return
    await tx.priceListItem.createMany({
      data: lines.map((line) => ({
        priceListId,
        itemId: line.itemId,
        unitPrice: new Decimal(line.unitPrice || '0'),
      })),
    })
  })
}

export async function assignCustomerPriceList(
  ctx: OrgContext,
  input: { customerId: string; priceListId: string | null },
) {
  const customer = await db.customer.findFirst({
    where: { id: input.customerId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!customer) throw notFound('Customer')
  if (input.priceListId) {
    const list = await db.priceList.findFirst({
      where: { id: input.priceListId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!list) throw notFound('Price list')
  }
  return db.customer.update({
    where: { id: customer.id },
    data: { priceListId: input.priceListId },
  })
}

export async function listPromotions(ctx: OrgContext) {
  return db.itemPromotion.findMany({
    where: { orgId: ctx.orgId },
    include: { item: { select: { id: true, name: true } } },
    orderBy: [{ startsOn: 'desc' }, { name: 'asc' }],
    take: 200,
  })
}

export async function upsertPromotion(
  ctx: OrgContext,
  input: {
    id?: string
    name: string
    itemId?: string | null
    percentOff: string
    startsOn: string
    endsOn: string
    isActive?: boolean
  },
) {
  const name = input.name.trim()
  if (!name) throw validation('Promotion name is required.')
  const percentOff = new Decimal(input.percentOff || '0')
  if (percentOff.lessThanOrEqualTo(0) || percentOff.greaterThan(100)) {
    throw validation('Percent off must be between 0 and 100.')
  }
  const startsOn = toDate(input.startsOn)
  const endsOn = toDate(input.endsOn)
  if (endsOn < startsOn) throw validation('Promotion end date must be on or after the start.')

  if (input.itemId) {
    const item = await db.item.findFirst({
      where: { id: input.itemId, orgId: ctx.orgId, deletedAt: null },
      select: { id: true },
    })
    if (!item) throw notFound('Item')
  }

  const data = {
    name,
    itemId: input.itemId || null,
    percentOff,
    startsOn,
    endsOn,
    isActive: input.isActive ?? true,
  }

  if (input.id) {
    const existing = await db.itemPromotion.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Promotion')
    return db.itemPromotion.update({ where: { id: existing.id }, data })
  }

  return db.itemPromotion.create({
    data: { orgId: ctx.orgId, ...data },
  })
}

/** Active promo percent for an item on a date (highest wins). */
export async function activePromoPercent(
  ctx: OrgContext,
  itemId: string,
  asOf?: string,
): Promise<number> {
  const day = asOf ?? today(ctx.organization.timeZone)
  const date = toDate(day)
  const promos = await db.itemPromotion.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      startsOn: { lte: date },
      endsOn: { gte: date },
      OR: [{ itemId }, { itemId: null }],
    },
    select: { percentOff: true, itemId: true },
  })
  let best = 0
  for (const promo of promos) {
    const pct = Number(promo.percentOff.toString())
    if (promo.itemId === itemId || (!promo.itemId && pct > best)) {
      if (pct > best) best = pct
    }
  }
  // Prefer item-specific over blanket when equal — already covered by max.
  for (const promo of promos) {
    if (promo.itemId === itemId) {
      const pct = Number(promo.percentOff.toString())
      if (pct > best) best = pct
    }
  }
  return best
}

export async function resolveListUnitPrice(
  ctx: OrgContext,
  input: { itemId: string; customerId?: string | null },
): Promise<string | null> {
  if (!input.customerId) return null
  const customer = await db.customer.findFirst({
    where: { id: input.customerId, orgId: ctx.orgId },
    select: { priceListId: true },
  })
  if (!customer?.priceListId) return null
  const row = await db.priceListItem.findFirst({
    where: { priceListId: customer.priceListId, itemId: input.itemId },
    select: { unitPrice: true },
  })
  return row?.unitPrice.toString() ?? null
}

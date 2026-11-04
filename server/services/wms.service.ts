import 'server-only'

import { Decimal } from '@/lib/money'
import {
  binCodeValid,
  canCancelPick,
  canCompletePick,
  canStartPick,
  type PickStatus,
} from '@/lib/erp/wms-pick'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'

export async function listBoard(ctx: OrgContext) {
  assertPermission(ctx, 'inventory:read')
  const [stores, bins, picks, items] = await Promise.all([
    db.store.findMany({
      where: { orgId: ctx.orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.stockBin.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { code: 'asc' },
      include: { store: { select: { name: true } } },
      take: 80,
    }),
    db.pickTask.findMany({
      where: { orgId: ctx.orgId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        item: { select: { name: true } },
        store: { select: { name: true } },
        bin: { select: { code: true } },
      },
      take: 80,
    }),
    db.item.findMany({
      where: { orgId: ctx.orgId, isActive: true, deletedAt: null, type: { in: ['INVENTORY', 'INVENTORY_ASSEMBLY'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ])
  return {
    stores,
    bins,
    picks: picks.map((row) => ({ ...row, qty: row.qty.toString() })),
    items,
  }
}

export async function createBin(
  ctx: OrgContext,
  input: { storeId: string; code: string; name: string },
) {
  assertPermission(ctx, 'inventory:adjust')
  const code = input.code.trim().toUpperCase()
  if (!binCodeValid(code)) throw validation('Bin code: letters, numbers, dot or dash.')
  const store = await db.store.findFirst({
    where: { id: input.storeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!store) throw notFound('Store')
  const name = input.name.trim() || code
  return db.stockBin.create({
    data: { orgId: ctx.orgId, storeId: store.id, code, name },
    select: { id: true },
  })
}

export async function createPick(
  ctx: OrgContext,
  input: { storeId: string; itemId: string; qty: string; binId?: string | null },
) {
  assertPermission(ctx, 'inventory:adjust')
  const qty = new Decimal(input.qty)
  if (qty.lessThanOrEqualTo(0)) throw validation('Quantity must be greater than zero.')
  const store = await db.store.findFirst({
    where: { id: input.storeId, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!store) throw notFound('Store')
  const item = await db.item.findFirst({
    where: { id: input.itemId, orgId: ctx.orgId, deletedAt: null },
    select: { id: true },
  })
  if (!item) throw notFound('Item')
  let binId: string | null = null
  if (input.binId) {
    const bin = await db.stockBin.findFirst({
      where: { id: input.binId, orgId: ctx.orgId, storeId: store.id },
      select: { id: true },
    })
    if (!bin) throw notFound('Bin')
    binId = bin.id
  }
  return db.pickTask.create({
    data: {
      orgId: ctx.orgId,
      storeId: store.id,
      itemId: item.id,
      binId,
      qty: qty.toFixed(4),
    },
    select: { id: true },
  })
}

export async function startPick(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'inventory:adjust')
  const row = await db.pickTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Pick')
  if (!canStartPick(row.status as PickStatus)) throw precondition('This pick cannot start.')
  return db.pickTask.update({
    where: { id: row.id },
    data: { status: 'PICKING' },
    select: { id: true },
  })
}

export async function completePick(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'inventory:adjust')
  const row = await db.pickTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Pick')
  if (!canCompletePick(row.status as PickStatus)) throw precondition('This pick cannot complete.')
  return db.pickTask.update({
    where: { id: row.id },
    data: { status: 'PICKED' },
    select: { id: true },
  })
}

export async function cancelPick(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'inventory:adjust')
  const row = await db.pickTask.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Pick')
  if (!canCancelPick(row.status as PickStatus)) throw precondition('This pick cannot cancel.')
  return db.pickTask.update({
    where: { id: row.id },
    data: { status: 'CANCELLED' },
    select: { id: true },
  })
}

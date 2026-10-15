import 'server-only'

import {
  summarizeBarcodeCatalog,
  type BarcodeCatalogRow,
} from '@/lib/barcode-catalog'
import { nextInternalEan13 } from '@/lib/barcode-ean13'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, validation } from '@/server/errors'
import * as itemService from '@/server/services/item.service'

export type BarcodeItemRow = BarcodeCatalogRow

export async function overview(ctx: OrgContext) {
  const rows = await db.item.findMany({
    where: { orgId: ctx.orgId, deletedAt: null },
    select: { id: true, name: true, sku: true, barcode: true, type: true, isActive: true },
    orderBy: [{ name: 'asc' }],
  })

  return summarizeBarcodeCatalog(rows as BarcodeItemRow[])
}

/** Assign a new internal EAN-13 to every active product that still has no barcode. */
export async function generateMissing(ctx: OrgContext) {
  const snap = await overview(ctx)
  const existing = snap.all.map((row) => row.barcode)
  let assigned = 0
  const codes: string[] = []

  for (const item of snap.missing) {
    const code = nextInternalEan13([...existing, ...codes])
    await itemService.setBarcode(ctx, item.id, code)
    codes.push(code)
    assigned += 1
  }

  return { assigned, codes }
}

/** Assign (or replace) one item's barcode with a freshly generated internal EAN-13. */
export async function generateOne(ctx: OrgContext, itemId: string, replace = false) {
  const item = await db.item.findFirst({
    where: { id: itemId, orgId: ctx.orgId, deletedAt: null },
    select: { id: true, name: true, barcode: true },
  })
  if (!item) throw notFound('Item')
  if (item.barcode && !replace) {
    throw validation(`"${item.name}" already has barcode ${item.barcode}.`, {
      barcode: ['Already set — choose Replace to overwrite'],
    })
  }

  const others = await db.item.findMany({
    where: { orgId: ctx.orgId, deletedAt: null, NOT: { id: item.id } },
    select: { barcode: true },
  })
  const code = nextInternalEan13(others.map((row) => row.barcode))
  await itemService.setBarcode(ctx, item.id, code)
  return { id: item.id, name: item.name, barcode: code }
}

export async function rowsForExport(ctx: OrgContext) {
  const snap = await overview(ctx)
  return snap.labelled.map((row) => ({
    name: row.name,
    sku: row.sku ?? '',
    barcode: row.barcode ?? '',
    type: row.type,
    active: row.isActive ? 'Yes' : 'No',
  }))
}

export async function rowsForPrint(ctx: OrgContext, ids?: string[]) {
  const where =
    ids && ids.length > 0
      ? { orgId: ctx.orgId, deletedAt: null, id: { in: ids }, barcode: { not: null } }
      : { orgId: ctx.orgId, deletedAt: null, barcode: { not: null }, isActive: true }

  return db.item.findMany({
    where,
    select: { id: true, name: true, sku: true, barcode: true },
    orderBy: [{ name: 'asc' }],
  })
}

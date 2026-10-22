import 'server-only'

import type { PurchaseDocumentType, SalesDocumentType } from '@prisma/client'

import { today } from '@/lib/date'
import {
  DOCUMENT_PACK_LIMIT,
  isPackableStatus,
  parsePackIds,
  sortPackDocuments,
} from '@/lib/document-pack'
import { presetRange, readDatePreset } from '@/lib/list-filters'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as purchaseService from '@/server/services/purchase.service'
import * as salesService from '@/server/services/sales.service'

const PACK_QUERY = { page: 1, pageSize: DOCUMENT_PACK_LIMIT, dir: 'asc' as const }

export function packFiltersFrom(search: URLSearchParams) {
  return {
    ids: parsePackIds(search.get('ids')),
    customerId: search.get('customer') || undefined,
    vendorId: search.get('vendorId') || undefined,
    status: search.get('status') || undefined,
    date: search.get('date') || undefined,
  }
}

export async function loadSalesPack(
  ctx: OrgContext,
  type: SalesDocumentType,
  search: URLSearchParams,
) {
  const filters = packFiltersFrom(search)
  const ids = await salesPackIds(ctx, type, filters)
  return salesService.getMany(ctx, ids)
}

export async function loadPurchasePack(
  ctx: OrgContext,
  type: PurchaseDocumentType | undefined,
  search: URLSearchParams,
) {
  const filters = packFiltersFrom(search)
  const ids = await purchasePackIds(ctx, type, filters)
  return purchaseService.getMany(ctx, ids)
}

async function salesPackIds(
  ctx: OrgContext,
  type: SalesDocumentType,
  filters: ReturnType<typeof packFiltersFrom>,
) {
  if (filters.ids.length) {
    const rows = await db.salesDocument.findMany({
      where: {
        orgId: ctx.orgId,
        type,
        id: { in: filters.ids },
        deletedAt: null,
        status: { not: 'VOID' },
      },
      select: { id: true, date: true, number: true },
    })
    return sortPackDocuments(rows).map((row) => row.id)
  }

  if (!filters.customerId) return []

  const range = presetRange(readDatePreset(filters.date), today(ctx.organization.timeZone))
  const page = await salesService.list(ctx, type, PACK_QUERY, {
    status: filters.status,
    customerId: filters.customerId,
    sort: 'date',
    dir: 'asc',
    from: range?.from,
    to: range?.to,
  })
  return page.rows.filter((row) => isPackableStatus(row.status)).map((row) => row.id)
}

async function purchasePackIds(
  ctx: OrgContext,
  type: PurchaseDocumentType | undefined,
  filters: ReturnType<typeof packFiltersFrom>,
) {
  if (filters.ids.length) {
    const rows = await db.purchaseDocument.findMany({
      where: {
        orgId: ctx.orgId,
        ...(type && type !== 'EXPENSE' ? { type } : {}),
        id: { in: filters.ids },
        deletedAt: null,
        status: { not: 'VOID' },
      },
      select: { id: true, date: true, number: true },
    })
    return sortPackDocuments(rows).map((row) => row.id)
  }

  if (!filters.vendorId || !type) return []

  const range = presetRange(readDatePreset(filters.date), today(ctx.organization.timeZone))
  const page = await purchaseService.list(ctx, type, PACK_QUERY, {
    status: filters.status,
    vendorId: filters.vendorId,
    sort: 'date',
    dir: 'asc',
    from: range?.from,
    to: range?.to,
  })
  return page.rows.filter((row) => isPackableStatus(row.status)).map((row) => row.id)
}

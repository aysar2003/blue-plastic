import 'server-only'

import {
  canTransitionDiningTable,
  type DiningTableStatus,
} from '@/lib/erp/dining-table'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, validation } from '@/server/errors'

export async function listTables(ctx: OrgContext) {
  return db.diningTable.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    orderBy: [{ zone: 'asc' }, { code: 'asc' }],
  })
}

export async function upsertTable(
  ctx: OrgContext,
  input: {
    id?: string
    code: string
    name: string
    seats?: number
    zone?: string | null
  },
) {
  const code = input.code.trim()
  const name = input.name.trim()
  if (!code || !name) throw validation('Table code and name are required.')

  if (input.id) {
    const existing = await db.diningTable.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { id: true },
    })
    if (!existing) throw notFound('Dining table')
    try {
      return await db.diningTable.update({
        where: { id: input.id },
        data: {
          code,
          name,
          seats: input.seats ?? 4,
          zone: input.zone?.trim() || null,
        },
      })
    } catch {
      throw conflict('Another table already uses that code.')
    }
  }

  try {
    return await db.diningTable.create({
      data: {
        orgId: ctx.orgId,
        code,
        name,
        seats: input.seats ?? 4,
        zone: input.zone?.trim() || null,
      },
    })
  } catch {
    throw conflict('Another table already uses that code.')
  }
}

export async function setTableStatus(
  ctx: OrgContext,
  tableId: string,
  status: DiningTableStatus,
) {
  const table = await db.diningTable.findFirst({
    where: { id: tableId, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!table) throw notFound('Dining table')
  if (!canTransitionDiningTable(table.status as DiningTableStatus, status)) {
    throw validation(`Cannot move table from ${table.status} to ${status}.`)
  }
  return db.diningTable.update({
    where: { id: table.id },
    data: { status },
  })
}

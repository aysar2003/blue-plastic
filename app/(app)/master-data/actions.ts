'use server'

import { z } from 'zod'

import { cuid } from '@/lib/validation/common'
import { action } from '@/server/action'
import { db } from '@/server/db'
import { notFound } from '@/server/errors'

const kindSchema = z.enum(['customer', 'vendor', 'item', 'account'])

function fold(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

/**
 * Other records this one can merge into. Same-name (case-insensitive) matches
 * sort first so duplicate cleanup is one click away.
 */
export const listMergeTargets = action
  .input(z.object({ kind: kindSchema, id: cuid }))
  .handler(async (ctx, input) => {
    if (input.kind === 'customer') {
      if (!ctx.permissions.has('customer:delete')) throw notFound('Customer')
      const self = await db.customer.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
        select: { displayName: true },
      })
      if (!self) throw notFound('Customer')
      const rows = await db.customer.findMany({
        where: { orgId: ctx.orgId, id: { not: input.id } },
        select: { id: true, displayName: true },
        orderBy: { displayName: 'asc' },
        take: 500,
      })
      const key = fold(self.displayName)
      return sortPreferSame(
        rows.map((row) => ({ id: row.id, label: row.displayName, name: row.displayName })),
        key,
      )
    }

    if (input.kind === 'vendor') {
      if (!ctx.permissions.has('vendor:delete')) throw notFound('Vendor')
      const self = await db.vendor.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
        select: { displayName: true },
      })
      if (!self) throw notFound('Vendor')
      const rows = await db.vendor.findMany({
        where: { orgId: ctx.orgId, id: { not: input.id } },
        select: { id: true, displayName: true },
        orderBy: { displayName: 'asc' },
        take: 500,
      })
      const key = fold(self.displayName)
      return sortPreferSame(
        rows.map((row) => ({ id: row.id, label: row.displayName, name: row.displayName })),
        key,
      )
    }

    if (input.kind === 'item') {
      if (!ctx.permissions.has('item:delete')) throw notFound('Item')
      const self = await db.item.findFirst({
        where: { id: input.id, orgId: ctx.orgId, deletedAt: null },
        select: { name: true },
      })
      if (!self) throw notFound('Item')
      const rows = await db.item.findMany({
        where: { orgId: ctx.orgId, id: { not: input.id }, deletedAt: null },
        select: { id: true, name: true, sku: true },
        orderBy: { name: 'asc' },
        take: 500,
      })
      const key = fold(self.name)
      return sortPreferSame(
        rows.map((row) => ({
          id: row.id,
          label: row.sku ? `${row.name} (${row.sku})` : row.name,
          name: row.name,
        })),
        key,
      )
    }

    if (!ctx.permissions.has('account:delete')) throw notFound('Account')
    const self = await db.ledgerAccount.findFirst({
      where: { id: input.id, orgId: ctx.orgId },
      select: { name: true, type: true },
    })
    if (!self) throw notFound('Account')
    const rows = await db.ledgerAccount.findMany({
      where: { orgId: ctx.orgId, id: { not: input.id }, type: self.type },
      select: { id: true, code: true, name: true },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      take: 500,
    })
    const key = fold(self.name)
    return sortPreferSame(
      rows.map((row) => ({
        id: row.id,
        label: `${row.code} · ${row.name}`,
        name: row.name,
      })),
      key,
    )
  })

function sortPreferSame(
  rows: Array<{ id: string; label: string; name: string }>,
  key: string,
): Array<{ id: string; label: string }> {
  return [...rows]
    .sort((a, b) => {
      const aSame = fold(a.name) === key ? 0 : 1
      const bSame = fold(b.name) === key ? 0 : 1
      return aSame - bSame || a.label.localeCompare(b.label)
    })
    .map(({ id, label }) => ({ id, label }))
}

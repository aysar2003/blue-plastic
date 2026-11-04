import 'server-only'

import {
  canBumpKitchen,
  nextKitchenStatus,
  parseKitchenLines,
  type KitchenStatus,
} from '@/lib/erp/kitchen-ticket'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition, validation } from '@/server/errors'

export async function listTickets(ctx: OrgContext) {
  assertPermission(ctx, 'pos:read')
  const rows = await db.kitchenTicket.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 80,
  })
  return rows.map((row) => ({
    ...row,
    lines: parseKitchenLines(row.lines),
  }))
}

export async function openTicket(
  ctx: OrgContext,
  input: { tableLabel?: string | null; covers?: string; lines: string; notes?: string | null },
) {
  assertPermission(ctx, 'pos:sell')
  const lines = parseKitchenLines(
    input.lines
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, qty] = line.split(/\s*[x×]\s*/i)
        return { name: (name ?? line).trim(), qty: (qty ?? '1').trim() }
      }),
  )
  if (lines.length === 0) throw validation('Add at least one line (Name x Qty).')
  const covers = Math.max(1, Number(input.covers) || 1)
  return db.kitchenTicket.create({
    data: {
      orgId: ctx.orgId,
      tableLabel: input.tableLabel?.trim() || null,
      covers,
      lines,
      notes: input.notes?.trim() || null,
    },
    select: { id: true },
  })
}

export async function bumpTicket(ctx: OrgContext, id: string) {
  assertPermission(ctx, 'pos:sell')
  const row = await db.kitchenTicket.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!row) throw notFound('Ticket')
  const next = nextKitchenStatus(row.status as KitchenStatus)
  if (!next || !canBumpKitchen(row.status as KitchenStatus, next)) {
    throw precondition('This ticket is already done.')
  }
  return db.kitchenTicket.update({
    where: { id: row.id },
    data: { status: next },
    select: { id: true, status: true },
  })
}

import 'server-only'

import { money } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound } from '@/server/errors'

export async function list(ctx: OrgContext) {
  const rows = await db.hrBudget.findMany({
    where: { orgId: ctx.orgId },
    include: {
      months: { select: { plannedWage: true, plannedHeadcount: true } },
    },
    orderBy: { year: 'desc' },
  })
  return rows.map((row) => ({
    id: row.id,
    year: row.year,
    name: row.name,
    notes: row.notes,
    totalWage: row.months.reduce((s, m) => s.plus(m.plannedWage), money(0)).toFixed(4),
    maxHeadcount: row.months.reduce((max, m) => Math.max(max, m.plannedHeadcount), 0),
  }))
}

export async function get(ctx: OrgContext, id: string) {
  const row = await db.hrBudget.findFirst({
    where: { id, orgId: ctx.orgId },
    include: { months: { orderBy: { month: 'asc' } } },
  })
  if (!row) throw notFound('HR budget')
  return {
    id: row.id,
    year: row.year,
    name: row.name,
    notes: row.notes,
    months: row.months.map((m) => ({
      id: m.id,
      month: m.month,
      plannedWage: m.plannedWage.toFixed(4),
      plannedHeadcount: m.plannedHeadcount,
    })),
  }
}

export async function create(
  ctx: OrgContext,
  input: { year: number; name: string; notes?: string | null },
) {
  const existing = await db.hrBudget.findFirst({
    where: { orgId: ctx.orgId, year: input.year },
  })
  if (existing) throw conflict(`A budget for ${input.year} already exists.`)

  const row = await db.hrBudget.create({
    data: {
      orgId: ctx.orgId,
      year: input.year,
      name: input.name,
      notes: input.notes ?? null,
      months: {
        create: Array.from({ length: 12 }, (_, i) => ({
          orgId: ctx.orgId,
          month: i + 1,
          plannedWage: money(0),
          plannedHeadcount: 0,
        })),
      },
    },
  })
  return { id: row.id }
}

export async function updateMonth(
  ctx: OrgContext,
  input: { budgetId: string; month: number; plannedWage: string; plannedHeadcount: number },
) {
  const budget = await db.hrBudget.findFirst({
    where: { id: input.budgetId, orgId: ctx.orgId },
  })
  if (!budget) throw notFound('HR budget')

  const row = await db.hrBudgetMonth.update({
    where: {
      budgetId_month: { budgetId: input.budgetId, month: input.month },
    },
    data: {
      plannedWage: money(input.plannedWage),
      plannedHeadcount: input.plannedHeadcount,
    },
  })
  return { id: row.id, month: row.month }
}

export async function remove(ctx: OrgContext, id: string) {
  const row = await db.hrBudget.findFirst({ where: { id, orgId: ctx.orgId } })
  if (!row) throw notFound('HR budget')
  await db.hrBudget.delete({ where: { id } })
}

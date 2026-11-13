import 'server-only'

import { toDate, type CalendarDate } from '@/lib/date'
import {
  addLaborCost,
  addPurchaseCost,
  addSalesIncome,
  addStockCost,
  emptySlice,
  mergeSlices,
  profitOf,
  type ProjectProfitSlice,
} from '@/lib/project-profitability'
import { Decimal } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

const POSTED_SALES = ['INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT'] as const
const POSTED_PURCHASES = ['BILL', 'EXPENSE', 'VENDOR_CREDIT'] as const

export type ProjectProfitRow = {
  projectId: string
  number: string
  name: string
  customerName: string
  income: Decimal
  purchaseCost: Decimal
  stockCost: Decimal
  laborCost: Decimal
  profit: Decimal
}

/**
 * Job P&amp;L for a date range: posted sales income, purchase cost, COGS from
 * stock issued on those sales, and timesheet labor at billable rate.
 */
export async function profitabilityByRange(
  ctx: OrgContext,
  range: { from: CalendarDate; to: CalendarDate },
  options: { projectId?: string } = {},
): Promise<{ rows: ProjectProfitRow[]; totals: ProjectProfitSlice & { profit: Decimal } }> {
  const projectFilter = options.projectId ? { id: options.projectId } : {}
  const [projects, sales, purchases, timeEntries] = await Promise.all([
    db.project.findMany({
      where: { orgId: ctx.orgId, ...projectFilter },
      select: { id: true, number: true, name: true, customer: { select: { displayName: true } } },
      orderBy: { number: 'asc' },
    }),
    db.salesDocument.findMany({
      where: {
        orgId: ctx.orgId,
        ...(options.projectId ? { projectId: options.projectId } : { projectId: { not: null } }),
        type: { in: [...POSTED_SALES] },
        status: { notIn: ['DRAFT', 'VOID', 'PENDING_APPROVAL'] },
        deletedAt: null,
        date: { gte: toDate(range.from), lte: toDate(range.to) },
      },
      select: {
        id: true,
        projectId: true,
        type: true,
        subtotal: true,
      },
    }),
    db.purchaseDocument.findMany({
      where: {
        orgId: ctx.orgId,
        ...(options.projectId ? { projectId: options.projectId } : { projectId: { not: null } }),
        type: { in: [...POSTED_PURCHASES] },
        status: { notIn: ['DRAFT', 'VOID', 'PENDING_APPROVAL', 'MATCH_HOLD'] },
        deletedAt: null,
        date: { gte: toDate(range.from), lte: toDate(range.to) },
      },
      select: { projectId: true, type: true, subtotal: true },
    }),
    db.projectTimeEntry.findMany({
      where: {
        orgId: ctx.orgId,
        ...(options.projectId ? { projectId: options.projectId } : {}),
        workDate: { gte: toDate(range.from), lte: toDate(range.to) },
      },
      select: { projectId: true, hours: true, billableRate: true },
    }),
  ])

  const saleIds = sales.map((row) => row.id)
  const movements =
    saleIds.length === 0
      ? []
      : await db.inventoryTransaction.findMany({
          where: {
            orgId: ctx.orgId,
            sourceId: { in: saleIds },
            type: { in: ['SALE', 'SALE_RETURN'] },
          },
          select: { sourceId: true, value: true },
        })

  const saleProject = new Map(sales.map((row) => [row.id, row.projectId]))
  const byProject = new Map<string, ProjectProfitSlice>()

  for (const document of sales) {
    if (!document.projectId) continue
    const prior = byProject.get(document.projectId) ?? emptySlice()
    byProject.set(
      document.projectId,
      addSalesIncome(prior, document.type, document.subtotal.toString()),
    )
  }

  for (const document of purchases) {
    if (!document.projectId) continue
    const prior = byProject.get(document.projectId) ?? emptySlice()
    byProject.set(
      document.projectId,
      addPurchaseCost(prior, document.type, document.subtotal.toString()),
    )
  }

  for (const movement of movements) {
    if (!movement.sourceId) continue
    const projectId = saleProject.get(movement.sourceId)
    if (!projectId) continue
    const prior = byProject.get(projectId) ?? emptySlice()
    byProject.set(projectId, addStockCost(prior, movement.value.toString()))
  }

  for (const entry of timeEntries) {
    const prior = byProject.get(entry.projectId) ?? emptySlice()
    byProject.set(
      entry.projectId,
      addLaborCost(prior, entry.hours.toString(), entry.billableRate?.toString() ?? null),
    )
  }

  const rows: ProjectProfitRow[] = []
  let totals = emptySlice()

  for (const project of projects) {
    const slice = byProject.get(project.id)
    if (!slice) continue
    if (
      slice.income.isZero() &&
      slice.purchaseCost.isZero() &&
      slice.stockCost.isZero() &&
      slice.laborCost.isZero()
    ) {
      continue
    }
    totals = mergeSlices(totals, slice)
    rows.push({
      projectId: project.id,
      number: project.number,
      name: project.name,
      customerName: project.customer.displayName,
      income: slice.income,
      purchaseCost: slice.purchaseCost,
      stockCost: slice.stockCost,
      laborCost: slice.laborCost,
      profit: profitOf(slice),
    })
  }

  return {
    rows,
    totals: { ...totals, profit: profitOf(totals) },
  }
}

export async function profitabilityForProject(
  ctx: OrgContext,
  projectId: string,
  range: { from: CalendarDate; to: CalendarDate },
) {
  const { rows, totals } = await profitabilityByRange(ctx, range, { projectId })
  return {
    row: rows[0] ?? null,
    totals,
  }
}

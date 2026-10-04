import 'server-only'

import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export type ActivityKind = 'all' | 'sales' | 'purchases' | 'adjustments'
export type PriceView = 'both' | 'cost' | 'sales'

export type ItemActivity = {
  date: CalendarDate
  type: string
  number: string
  party: string
  quantity: string
  cost: string | null
  salesPrice: string | null
  amount: string
  href: string
}

const money = (value: Decimal.Value) => toMoneyString(value, 2)

const SALES_LABEL: Record<string, string> = {
  INVOICE: 'Invoice',
  SALES_RECEIPT: 'Sales receipt',
  CREDIT_MEMO: 'Credit memo',
  REFUND_RECEIPT: 'Refund receipt',
}

const PURCHASE_LABEL: Record<string, string> = {
  BILL: 'Bill',
  EXPENSE: 'Expense',
  VENDOR_CREDIT: 'Vendor credit',
}

function salesPath(type: string) {
  if (type === 'SALES_RECEIPT') return 'sales-receipts'
  if (type === 'CREDIT_MEMO') return 'credit-memos'
  if (type === 'REFUND_RECEIPT') return 'refunds'
  return 'invoices'
}

function purchasePath(type: string) {
  if (type === 'EXPENSE') return 'expenses'
  if (type === 'VENDOR_CREDIT') return 'vendor-credits'
  return 'bills'
}

/** A sale issues stock; a credit puts it back. Quantity on the document is unsigned. */
function salesSign(type: string) {
  return type === 'CREDIT_MEMO' || type === 'REFUND_RECEIPT' ? 1 : -1
}

function purchaseSign(type: string) {
  return type === 'VENDOR_CREDIT' ? -1 : 1
}

/**
 * Every posted sale, purchase and count for one item.
 *
 * The sales price is what was charged. The cost is what the stock ledger issued,
 * or what the bill paid. A service has a sales price and no cost.
 */
export async function itemActivity(
  ctx: OrgContext,
  itemId: string,
  range: { from: CalendarDate; to: CalendarDate },
  kind: ActivityKind,
): Promise<ItemActivity[]> {
  const from = toDate(range.from)
  const to = toDate(range.to)
  const salesPosted = { notIn: ['DRAFT', 'VOID', 'DECLINED'] as const }
  const purchasePosted = { notIn: ['DRAFT', 'VOID'] as const }
  const rows: (ItemActivity & { sort: string })[] = []

  if (kind === 'all' || kind === 'sales') {
    const lines = await db.salesDocumentLine.findMany({
      where: {
        orgId: ctx.orgId,
        itemId,
        document: {
          orgId: ctx.orgId,
          deletedAt: null,
          status: salesPosted,
          date: { gte: from, lte: to },
          type: { in: ['INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT'] },
        },
      },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        amount: true,
        document: {
          select: {
            id: true,
            type: true,
            number: true,
            date: true,
            customer: { select: { displayName: true } },
          },
        },
      },
    })

    const costs = await db.inventoryTransaction.findMany({
      where: { orgId: ctx.orgId, itemId, sourceLineId: { in: lines.map((line) => line.id) } },
      select: { sourceLineId: true, unitCost: true },
    })
    const costByLine = new Map(costs.map((row) => [row.sourceLineId, row.unitCost.toString()]))

    for (const line of lines) {
      const doc = line.document
      const qty = new Decimal(line.quantity.toString()).times(salesSign(doc.type))
      rows.push({
        sort: `${toCalendarDate(doc.date)}-${doc.number}-${line.id}`,
        date: toCalendarDate(doc.date),
        type: SALES_LABEL[doc.type] ?? doc.type,
        number: doc.number,
        party: doc.customer.displayName,
        quantity: qty.toFixed(2),
        cost: costByLine.get(line.id) ? money(costByLine.get(line.id)!) : null,
        salesPrice: money(line.unitPrice.toString()),
        amount: money(line.amount.toString()),
        href: `/sales/${salesPath(doc.type)}/${doc.id}`,
      })
    }
  }

  if (kind === 'all' || kind === 'purchases') {
    const lines = await db.purchaseDocumentLine.findMany({
      where: {
        orgId: ctx.orgId,
        itemId,
        document: {
          orgId: ctx.orgId,
          deletedAt: null,
          status: purchasePosted,
          date: { gte: from, lte: to },
          type: { in: ['BILL', 'EXPENSE', 'VENDOR_CREDIT'] },
        },
      },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        amount: true,
        document: {
          select: {
            id: true,
            type: true,
            number: true,
            date: true,
            vendor: { select: { displayName: true } },
          },
        },
      },
    })

    for (const line of lines) {
      const doc = line.document
      const qty = new Decimal(line.quantity.toString()).times(purchaseSign(doc.type))
      rows.push({
        sort: `${toCalendarDate(doc.date)}-${doc.number}-${line.id}`,
        date: toCalendarDate(doc.date),
        type: PURCHASE_LABEL[doc.type] ?? doc.type,
        number: doc.number,
        party: doc.vendor.displayName,
        quantity: qty.toFixed(2),
        cost: money(line.unitPrice.toString()),
        salesPrice: null,
        amount: money(line.amount.toString()),
        href: `/purchases/${purchasePath(doc.type)}/${doc.id}`,
      })
    }
  }

  if (kind === 'all' || kind === 'adjustments') {
    const [adjustments, openings] = await Promise.all([
      db.inventoryAdjustmentLine.findMany({
        where: {
          orgId: ctx.orgId,
          itemId,
          adjustment: { orgId: ctx.orgId, deletedAt: null, date: { gte: from, lte: to }, status: { not: 'VOID' } },
        },
        select: {
          id: true,
          quantityChange: true,
          unitCost: true,
          value: true,
          adjustment: {
            select: {
              number: true,
              date: true,
              journalId: true,
              reason: true,
              account: { select: { name: true } },
            },
          },
        },
      }),
      db.inventoryTransaction.findMany({
        where: { orgId: ctx.orgId, itemId, type: 'OPENING', date: { gte: from, lte: to } },
        select: {
          id: true,
          date: true,
          quantity: true,
          unitCost: true,
          value: true,
          journalId: true,
        },
      }),
    ])

    for (const line of adjustments) {
      rows.push({
        sort: `${toCalendarDate(line.adjustment.date)}-${line.adjustment.number}-${line.id}`,
        date: toCalendarDate(line.adjustment.date),
        type: 'Adjustment',
        number: line.adjustment.number,
        party: [line.adjustment.account.name, line.adjustment.reason].filter(Boolean).join(' · '),
        quantity: new Decimal(line.quantityChange.toString()).toFixed(2),
        cost: money(line.unitCost.toString()),
        salesPrice: null,
        amount: money(line.value.toString()),
        href: line.adjustment.journalId ? `/journals/${line.adjustment.journalId}` : `/inventory/${itemId}`,
      })
    }

    for (const opening of openings) {
      rows.push({
        sort: `${toCalendarDate(opening.date)}-opening-${opening.id}`,
        date: toCalendarDate(opening.date),
        type: 'Opening stock',
        number: '',
        party: 'Opening balance',
        quantity: new Decimal(opening.quantity.toString()).toFixed(2),
        cost: money(opening.unitCost.toString()),
        salesPrice: null,
        amount: money(opening.value.toString()),
        href: opening.journalId ? `/journals/${opening.journalId}` : `/inventory/${itemId}`,
      })
    }
  }

  rows.sort((a, b) => a.sort.localeCompare(b.sort))
  return rows
}

export function activityTotals(rows: ItemActivity[]) {
  return {
    quantity: rows.reduce((sum, row) => sum.plus(row.quantity), ZERO),
    amount: rows.reduce((sum, row) => sum.plus(row.amount), ZERO),
  }
}

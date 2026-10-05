import 'server-only'

import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { Decimal, toMoneyString, ZERO } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

export type ActivityKind = 'all' | 'sales' | 'purchases' | 'adjustments' | 'tickets'
export type PriceView = 'both' | 'cost' | 'sales'

export type ItemActivity = {
  date: CalendarDate
  type: string
  number: string
  /** Store issue ticket (TKT-) — shown on the sale line, not as a duplicate row. */
  ticketNumber: string | null
  ticketHref: string | null
  /** Shelf the goods left or entered — office or named store. */
  storeName: string | null
  storeHref: string | null
  party: string
  quantity: string
  /** On-hand after this line (tracked items only). */
  balance: string | null
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

const SALES_TYPES = new Set(Object.values(SALES_LABEL))
const PURCHASE_TYPES = new Set(Object.values(PURCHASE_LABEL))

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

function affectsOnHand(type: string) {
  return type !== 'Store ticket'
}

function matchesKind(type: string, kind: ActivityKind) {
  if (kind === 'all') return true
  if (kind === 'sales') return SALES_TYPES.has(type)
  if (kind === 'purchases') return PURCHASE_TYPES.has(type)
  if (kind === 'tickets') return type === 'Store ticket'
  if (kind === 'adjustments') return type === 'Adjustment' || type === 'Opening stock'
  return true
}

/** On-hand just before the report range, from the stock ledger. */
async function priorOnHand(ctx: OrgContext, itemId: string, from: Date): Promise<Decimal> {
  const prior = await db.inventoryTransaction.findFirst({
    where: { orgId: ctx.orgId, itemId, date: { lt: from } },
    orderBy: { sequence: 'desc' },
    select: { runningQuantity: true },
  })
  return new Decimal(prior?.runningQuantity?.toString() ?? '0')
}

type DraftRow = Omit<ItemActivity, 'balance'> & { sort: string }

/**
 * Every posted sale, purchase and count for one item.
 *
 * Sale-linked store tickets appear in the Ticket column on the invoice/receipt
 * row (international pick-list pattern). Transfers and manual tickets stay as
 * their own lines under the Tickets filter.
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
  const rows: DraftRow[] = []

  const item = await db.item.findFirst({
    where: { id: itemId, orgId: ctx.orgId },
    select: { type: true },
  })
  const tracked = item?.type === 'INVENTORY'

  const tickets = await db.storeTicket.findMany({
    where: {
      orgId: ctx.orgId,
      itemId,
      date: { gte: from, lte: to },
      status: { in: ['POSTED', 'VOID'] },
    },
    select: {
      id: true,
      number: true,
      date: true,
      storeId: true,
      quantity: true,
      unitCost: true,
      value: true,
      takenBy: true,
      origin: true,
      status: true,
      salesDocumentLineId: true,
      store: { select: { name: true } },
      toStore: { select: { name: true } },
      transfer: { select: { id: true, number: true } },
    },
    orderBy: { date: 'asc' },
  })

  const ticketBySalesLine = new Map(
    tickets
      .filter((t) => t.origin === 'SALE' && t.salesDocumentLineId && t.status === 'POSTED')
      .map((t) => [t.salesDocumentLineId!, t] as const),
  )

  const salesLines = await db.salesDocumentLine.findMany({
    where: {
      orgId: ctx.orgId,
      itemId,
      document: {
        orgId: ctx.orgId,
        deletedAt: null,
        status: { notIn: [...salesPosted.notIn] },
        date: { gte: from, lte: to },
        type: { in: ['INVOICE', 'SALES_RECEIPT', 'CREDIT_MEMO', 'REFUND_RECEIPT'] },
      },
    },
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      amount: true,
      storeId: true,
      store: { select: { id: true, name: true } },
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
    where: { orgId: ctx.orgId, itemId, sourceLineId: { in: salesLines.map((line) => line.id) } },
    select: { sourceLineId: true, unitCost: true },
  })
  const costByLine = new Map(costs.map((row) => [row.sourceLineId, row.unitCost.toString()]))

  for (const line of salesLines) {
    const doc = line.document
    const qty = new Decimal(line.quantity.toString()).times(salesSign(doc.type))
    const ticket = ticketBySalesLine.get(line.id)
    const storeId = line.store?.id ?? ticket?.storeId ?? null
    const storeName = line.store?.name ?? ticket?.store.name ?? null
    rows.push({
      sort: `${toCalendarDate(doc.date)}-${doc.number}-${line.id}`,
      date: toCalendarDate(doc.date),
      type: SALES_LABEL[doc.type] ?? doc.type,
      number: doc.number,
      ticketNumber: ticket?.number ?? null,
      ticketHref: ticket ? `/stores/tickets/${ticket.id}/print` : null,
      storeName,
      storeHref: storeId ? `/stores/${storeId}` : null,
      party: doc.customer.displayName,
      quantity: qty.toFixed(2),
      cost: costByLine.get(line.id) ? money(costByLine.get(line.id)!) : null,
      salesPrice: money(line.unitPrice.toString()),
      amount: money(line.amount.toString()),
      href: `/sales/${salesPath(doc.type)}/${doc.id}`,
    })
  }

  const purchaseLines = await db.purchaseDocumentLine.findMany({
    where: {
      orgId: ctx.orgId,
      itemId,
      document: {
        orgId: ctx.orgId,
        deletedAt: null,
        status: { notIn: [...purchasePosted.notIn] },
        date: { gte: from, lte: to },
        type: { in: ['BILL', 'EXPENSE', 'VENDOR_CREDIT'] },
      },
    },
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      amount: true,
      storeId: true,
      store: { select: { id: true, name: true } },
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

  for (const line of purchaseLines) {
    const doc = line.document
    const qty = new Decimal(line.quantity.toString()).times(purchaseSign(doc.type))
    rows.push({
      sort: `${toCalendarDate(doc.date)}-${doc.number}-${line.id}`,
      date: toCalendarDate(doc.date),
      type: PURCHASE_LABEL[doc.type] ?? doc.type,
      number: doc.number,
      ticketNumber: null,
      ticketHref: null,
      storeName: line.store?.name ?? null,
      storeHref: line.storeId ? `/stores/${line.storeId}` : null,
      party: doc.vendor.displayName,
      quantity: qty.toFixed(2),
      cost: money(line.unitPrice.toString()),
      salesPrice: null,
      amount: money(line.amount.toString()),
      href: `/purchases/${purchasePath(doc.type)}/${doc.id}`,
    })
  }

  for (const ticket of tickets) {
    // Sale pick tickets are on the invoice/receipt line — not a second row here.
    if (ticket.origin === 'SALE' && ticket.salesDocumentLineId) continue

    const storeLabel = ticket.toStore
      ? `${ticket.store.name} → ${ticket.toStore.name}`
      : ticket.store.name
    const party = ticket.takenBy ? `taken by ${ticket.takenBy}` : ticket.transfer?.number ?? 'Transfer / issue'
    rows.push({
      sort: `${toCalendarDate(ticket.date)}-${ticket.number}-${ticket.id}`,
      date: toCalendarDate(ticket.date),
      type: ticket.status === 'VOID' ? 'Store ticket (void)' : 'Store ticket',
      number: ticket.transfer?.number ?? '',
      ticketNumber: ticket.number,
      ticketHref: `/stores/tickets/${ticket.id}/print`,
      storeName: storeLabel,
      storeHref: `/stores/${ticket.storeId}`,
      party,
      quantity: new Decimal(ticket.quantity.toString()).negated().toFixed(2),
      cost: money(ticket.unitCost.toString()),
      salesPrice: null,
      amount: money(ticket.value.toString()),
      href: `/stores/${ticket.storeId}`,
    })
  }

  const [adjustments, openings] = await Promise.all([
    db.inventoryAdjustmentLine.findMany({
      where: {
        orgId: ctx.orgId,
        itemId,
        adjustment: {
          orgId: ctx.orgId,
          deletedAt: null,
          date: { gte: from, lte: to },
          status: { not: 'VOID' },
        },
      },
      select: {
        id: true,
        quantityChange: true,
        unitCost: true,
        value: true,
        adjustment: {
          select: {
            id: true,
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
        storeId: true,
        store: { select: { id: true, name: true } },
      },
    }),
  ])

  const adjustmentIds = adjustments.map((line) => line.adjustment.id)
  const adjustmentStores =
    adjustmentIds.length > 0
      ? await db.inventoryTransaction.findMany({
          where: {
            orgId: ctx.orgId,
            itemId,
            sourceType: 'INVENTORY_ADJUSTMENT',
            sourceId: { in: adjustmentIds },
          },
          select: {
            sourceId: true,
            sourceLineId: true,
            storeId: true,
            store: { select: { id: true, name: true } },
          },
        })
      : []
  const storeByAdjustmentLine = new Map(
    adjustmentStores
      .filter((row) => row.sourceLineId)
      .map((row) => [row.sourceLineId!, row] as const),
  )
  const storeByAdjustment = new Map(
    adjustmentStores.map((row) => [row.sourceId, row] as const),
  )

  for (const line of adjustments) {
    const shelf =
      storeByAdjustmentLine.get(line.id) ?? storeByAdjustment.get(line.adjustment.id) ?? null
    rows.push({
      sort: `${toCalendarDate(line.adjustment.date)}-${line.adjustment.number}-${line.id}`,
      date: toCalendarDate(line.adjustment.date),
      type: 'Adjustment',
      number: line.adjustment.number,
      ticketNumber: null,
      ticketHref: null,
      storeName: shelf?.store?.name ?? null,
      storeHref: shelf?.storeId ? `/stores/${shelf.storeId}` : null,
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
      ticketNumber: null,
      ticketHref: null,
      storeName: opening.store?.name ?? null,
      storeHref: opening.storeId ? `/stores/${opening.storeId}` : null,
      party: 'Opening balance',
      quantity: new Decimal(opening.quantity.toString()).toFixed(2),
      cost: money(opening.unitCost.toString()),
      salesPrice: null,
      amount: money(opening.value.toString()),
      href: opening.journalId ? `/journals/${opening.journalId}` : `/inventory/${itemId}`,
    })
  }

  rows.sort((a, b) => a.sort.localeCompare(b.sort))

  let balance = tracked ? await priorOnHand(ctx, itemId, from) : ZERO
  const withBalance: (ItemActivity & { sort: string })[] = rows.map((row) => {
    if (tracked && affectsOnHand(row.type)) {
      balance = balance.plus(row.quantity)
    }
    const { sort, ...rest } = row
    return {
      ...rest,
      sort,
      balance: tracked ? balance.toFixed(2) : null,
    }
  })

  return withBalance
    .filter((row) => matchesKind(row.type.replace(' (void)', ''), kind))
    .map(({ sort: _sort, ...row }) => row)
}

export function activityTotals(rows: ItemActivity[]) {
  const counted = rows.filter((row) => !row.type.startsWith('Store ticket'))
  const lastBalance = [...rows].reverse().find((row) => row.balance !== null)?.balance ?? null
  return {
    quantity: counted.reduce((sum, row) => sum.plus(row.quantity), ZERO),
    amount: counted.reduce((sum, row) => sum.plus(row.amount), ZERO),
    balance: lastBalance,
  }
}

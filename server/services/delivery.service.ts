import 'server-only'

import { toCalendarDate, type CalendarDate } from '@/lib/date'
import { Decimal, ZERO } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

/**
 * Delivery against purchase orders.
 *
 * An order is not a bill. Until something is received, nothing is in stock and
 * nothing is owed. This service answers the only questions the Delivery app asks:
 * what is still to come, what has arrived, and — line by line — where each order
 * stands.
 */

export type DeliveryBucket = 'not_delivered' | 'partial' | 'delivered'

export type DeliveryOrderRow = {
  id: string
  number: string
  date: CalendarDate
  vendorId: string
  vendorName: string
  status: string
  bucket: DeliveryBucket
  orderedQty: string
  receivedQty: string
  outstandingQty: string
  orderedValue: string
  receivedValue: string
  outstandingValue: string
  lineCount: number
  outstandingLines: number
  receiptCount: number
  href: string
  receiveHref: string
}

export type DeliveryLineRow = {
  lineId: string
  lineNumber: number
  itemName: string
  description: string | null
  ordered: string
  received: string
  outstanding: string
  unitPrice: string
  outstandingValue: string
}

export type DeliveryOrderDetail = DeliveryOrderRow & {
  lines: DeliveryLineRow[]
  receipts: { id: string; number: string; date: CalendarDate }[]
}

function qty(value: { toString(): string }) {
  return new Decimal(value.toString())
}

function bucketFor(status: string, receivedQty: Decimal, outstandingQty: Decimal): DeliveryBucket {
  if (status === 'CLOSED' || outstandingQty.isZero()) return 'delivered'
  if (receivedQty.isZero()) return 'not_delivered'
  return 'partial'
}

function summariseOrder(order: {
  id: string
  number: string
  date: Date
  status: string
  vendor: { id: string; displayName: string }
  lines: {
    id: string
    lineNumber: number
    description: string | null
    quantity: { toString(): string }
    quantityReceived: { toString(): string }
    unitPrice: { toString(): string }
    item: { name: string } | null
  }[]
  convertedTo: { id: string; number: string; date: Date }[]
}): DeliveryOrderDetail {
  let orderedQty = ZERO
  let receivedQty = ZERO
  let outstandingQty = ZERO
  let orderedValue = ZERO
  let receivedValue = ZERO
  let outstandingValue = ZERO
  let outstandingLines = 0

  const lines: DeliveryLineRow[] = order.lines.map((line) => {
    const ordered = qty(line.quantity)
    const received = qty(line.quantityReceived)
    const outstanding = Decimal.max(ordered.minus(received), 0)
    const price = qty(line.unitPrice)

    orderedQty = orderedQty.plus(ordered)
    receivedQty = receivedQty.plus(Decimal.min(received, ordered))
    outstandingQty = outstandingQty.plus(outstanding)
    orderedValue = orderedValue.plus(ordered.times(price))
    receivedValue = receivedValue.plus(Decimal.min(received, ordered).times(price))
    outstandingValue = outstandingValue.plus(outstanding.times(price))
    if (!outstanding.isZero()) outstandingLines += 1

    return {
      lineId: line.id,
      lineNumber: line.lineNumber,
      itemName: line.item?.name ?? line.description ?? 'Line',
      description: line.description,
      ordered: ordered.toFixed(2),
      received: received.toFixed(2),
      outstanding: outstanding.toFixed(2),
      unitPrice: price.toFixed(4),
      outstandingValue: outstanding.times(price).toFixed(2),
    }
  })

  const bucket = bucketFor(order.status, receivedQty, outstandingQty)

  return {
    id: order.id,
    number: order.number,
    date: toCalendarDate(order.date),
    vendorId: order.vendor.id,
    vendorName: order.vendor.displayName,
    status: order.status,
    bucket,
    orderedQty: orderedQty.toFixed(2),
    receivedQty: receivedQty.toFixed(2),
    outstandingQty: outstandingQty.toFixed(2),
    orderedValue: orderedValue.toFixed(2),
    receivedValue: receivedValue.toFixed(2),
    outstandingValue: outstandingValue.toFixed(2),
    lineCount: order.lines.length,
    outstandingLines,
    receiptCount: order.convertedTo.length,
    href: `/purchases/purchase-orders/${order.id}`,
    receiveHref: `/purchases/purchase-orders/${order.id}/receive`,
    lines,
    receipts: order.convertedTo.map((receipt) => ({
      id: receipt.id,
      number: receipt.number,
      date: toCalendarDate(receipt.date),
    })),
  }
}

const ORDER_SELECT = {
  id: true,
  number: true,
  date: true,
  status: true,
  vendor: { select: { id: true, displayName: true } },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    select: {
      id: true,
      lineNumber: true,
      description: true,
      quantity: true,
      quantityReceived: true,
      unitPrice: true,
      storeId: true,
      item: { select: { name: true } },
    },
  },
  convertedTo: {
    select: { id: true, number: true, date: true },
    orderBy: { date: 'asc' as const },
  },
}

/** Dashboard figures for the Delivery app. */
export async function overview(ctx: OrgContext) {
  const orders = await db.purchaseDocument.findMany({
    where: {
      orgId: ctx.orgId,
      type: 'PURCHASE_ORDER',
      status: { notIn: ['VOID', 'DRAFT'] },
      deletedAt: null,
    },
    select: ORDER_SELECT,
  })

  const rows = orders.map(summariseOrder)

  const notDelivered = rows.filter((row) => row.bucket === 'not_delivered')
  const partial = rows.filter((row) => row.bucket === 'partial')
  const delivered = rows.filter((row) => row.bucket === 'delivered')
  const outstanding = [...notDelivered, ...partial]

  const outstandingValue = outstanding.reduce(
    (sum, row) => sum.plus(row.outstandingValue),
    ZERO,
  )
  const outstandingQty = outstanding.reduce(
    (sum, row) => sum.plus(row.outstandingQty),
    ZERO,
  )
  const receivedValue = rows.reduce((sum, row) => sum.plus(row.receivedValue), ZERO)

  return {
    orders: rows.length,
    notDelivered: notDelivered.length,
    partial: partial.length,
    delivered: delivered.length,
    outstandingOrders: outstanding.length,
    outstandingValue: outstandingValue.toFixed(2),
    outstandingQty: outstandingQty.toFixed(2),
    receivedValue: receivedValue.toFixed(2),
    recentOutstanding: outstanding
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
      .slice(0, 8),
  }
}

function lineStoreId(lineStoreId: string | null, officeStoreId: string) {
  return lineStoreId ?? officeStoreId
}

/** True when this order still has quantity to receive for the given store. */
function orderHasOutstandingForStore(
  order: {
    lines: {
      storeId: string | null
      quantity: { toString(): string }
      quantityReceived: { toString(): string }
    }[]
  },
  storeId: string,
  officeStoreId: string,
) {
  return order.lines.some((line) => {
    if (lineStoreId(line.storeId, officeStoreId) !== storeId) return false
    const ordered = qty(line.quantity)
    const received = qty(line.quantityReceived)
    return ordered.minus(received).gt(0)
  })
}

/** Orders in one delivery bucket, newest first. */
export async function listOrders(
  ctx: OrgContext,
  filter: 'outstanding' | 'not_delivered' | 'partial' | 'delivered' | 'all' = 'all',
  options: { vendorId?: string; storeId?: string; officeStoreId?: string } = {},
): Promise<DeliveryOrderDetail[]> {
  const orders = await db.purchaseDocument.findMany({
    where: {
      orgId: ctx.orgId,
      type: 'PURCHASE_ORDER',
      status: { notIn: ['VOID', 'DRAFT'] },
      deletedAt: null,
      ...(options.vendorId ? { vendorId: options.vendorId } : {}),
    },
    select: ORDER_SELECT,
    orderBy: [{ date: 'desc' }, { number: 'desc' }],
  })

  let filtered = orders
  if (options.storeId && options.officeStoreId) {
    filtered = orders.filter((order) =>
      orderHasOutstandingForStore(order, options.storeId!, options.officeStoreId!),
    )
  }

  const rows = filtered.map(summariseOrder)

  if (filter === 'all') return rows
  if (filter === 'outstanding') {
    return rows.filter((row) => row.bucket === 'not_delivered' || row.bucket === 'partial')
  }
  return rows.filter((row) => row.bucket === filter)
}

/** Full delivery report — same rows as the list, kept as its own verb for the report screen. */
export async function detailReport(
  ctx: OrgContext,
  options: { vendorId?: string; filter?: 'outstanding' | 'delivered' | 'all' } = {},
): Promise<DeliveryOrderDetail[]> {
  return listOrders(ctx, options.filter ?? 'all', { vendorId: options.vendorId })
}

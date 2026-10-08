import 'server-only'

import { toCalendarDate, toDate, type CalendarDate } from '@/lib/date'
import { needsPickTicket } from '@/lib/pos-line-store'
import { Decimal, ZERO } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db, type Tx } from '@/server/db'
import { notFound } from '@/server/errors'
import { assignDocumentNumber } from '@/server/sequences'

/**
 * Sales delivery notes (dispatch / packing advice).
 *
 * International practice: when goods leave on an invoice or sales receipt, a
 * delivery note travels with the load — customer name, sale number, items, and
 * a serial of its own (DN-). It is paperwork for the carrier and the door, not
 * a second ledger entry.
 *
 * Store tickets are raised at the same time for every tracked item that left a
 * shelf, so stock out always has a ticket number that can be printed.
 */

export type DeliveryNoteListRow = {
  id: string
  number: string
  date: CalendarDate
  issuedAt: string
  customerId: string
  customerName: string
  salesDocumentId: string
  salesNumber: string
  salesType: string
  storeName: string | null
  lineCount: number
  quantity: string
  status: string
  href: string
  printHref: string
}

export type DeliveryNoteDetail = DeliveryNoteListRow & {
  carrier: string | null
  notes: string | null
  customerPhone: string | null
  customerEmail: string | null
  shipping: string[]
  lines: {
    lineNumber: number
    itemName: string | null
    description: string | null
    quantity: string
    storeName: string | null
    ticketNumber: string | null
    ticketId: string | null
  }[]
}

type MovementCost = {
  lineId: string
  itemId: string
  storeId: string | null
  quantity: Decimal
  unitCost: Decimal
  value: Decimal
}

/** A POS counter's own store: the register's store, else the office. */
export async function posCounterStoreId(
  client: Tx | typeof db,
  orgId: string,
  registerStoreId: string | null,
): Promise<string | null> {
  if (registerStoreId) return registerStoreId
  const office = await client.store.findFirst({
    where: { orgId, isActive: true, isOffice: true },
    select: { id: true },
  })
  return office?.id ?? null
}

/** After an invoice or sales receipt posts stock out — raise DN + tickets. */
export async function syncFromSale(
  tx: Tx,
  ctx: OrgContext,
  salesDocumentId: string,
  movements: MovementCost[],
) {
  const document = await tx.salesDocument.findFirst({
    where: { id: salesDocumentId, orgId: ctx.orgId, deletedAt: null },
    select: {
      id: true,
      type: true,
      number: true,
      date: true,
      customerId: true,
      customer: { select: { displayName: true } },
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true,
          lineNumber: true,
          itemId: true,
          description: true,
          quantity: true,
          storeId: true,
          item: { select: { id: true, name: true, type: true } },
        },
      },
    },
  })
  if (!document) return null
  if (document.type !== 'INVOICE' && document.type !== 'SALES_RECEIPT') return null

  const packLines = document.lines.filter((line) => {
    const qty = new Decimal(line.quantity.toString())
    return qty.gt(0) && (line.itemId || line.description)
  })
  const shipsGoods = packLines.some(
    (line) => line.item?.type === 'INVENTORY' || line.item?.type === 'NON_INVENTORY',
  )
  if (!shipsGoods) return null

  const storeIds = [
    ...new Set(packLines.map((line) => line.storeId).filter((id): id is string => Boolean(id))),
  ]
  const primaryStoreId = storeIds.length === 1 ? storeIds[0] : storeIds[0] ?? null

  const existing = await tx.deliveryNote.findFirst({
    where: { orgId: ctx.orgId, salesDocumentId: document.id },
    select: { id: true, number: true, status: true },
  })

  let noteId: string
  let noteNumber: string

  if (existing) {
    noteId = existing.id
    noteNumber = existing.number
    await tx.storeTicket.deleteMany({
      where: { orgId: ctx.orgId, salesDocumentId: document.id, origin: 'SALE' },
    })
    await tx.deliveryNoteLine.deleteMany({ where: { deliveryNoteId: noteId } })
    await tx.deliveryNote.update({
      where: { id: noteId },
      data: {
        date: document.date,
        issuedAt: new Date(),
        customerId: document.customerId,
        storeId: primaryStoreId,
        status: 'POSTED',
        voidedAt: null,
        voidReason: null,
      },
    })
  } else {
    noteNumber = await assignDocumentNumber(tx, ctx.orgId, 'DELIVERY_NOTE')
    const created = await tx.deliveryNote.create({
      data: {
        orgId: ctx.orgId,
        number: noteNumber,
        date: document.date,
        issuedAt: new Date(),
        customerId: document.customerId,
        salesDocumentId: document.id,
        storeId: primaryStoreId,
        createdById: ctx.userId,
        lines: {
          create: packLines.map((line) => ({
            orgId: ctx.orgId,
            lineNumber: line.lineNumber,
            itemId: line.itemId,
            description: line.description ?? line.item?.name ?? null,
            quantity: new Decimal(line.quantity.toString()).toFixed(4),
            storeId: line.storeId,
            salesDocumentLineId: line.id,
          })),
        },
      },
      select: { id: true },
    })
    noteId = created.id
  }

  if (existing) {
    await tx.deliveryNoteLine.createMany({
      data: packLines.map((line) => ({
        orgId: ctx.orgId,
        deliveryNoteId: noteId,
        lineNumber: line.lineNumber,
        itemId: line.itemId,
        description: line.description ?? line.item?.name ?? null,
        quantity: new Decimal(line.quantity.toString()).toFixed(4),
        storeId: line.storeId,
        salesDocumentLineId: line.id,
      })),
    })
  }

  const costByLine = new Map(movements.map((m) => [m.lineId, m]))
  const takenBy = document.customer.displayName

  // A POS sale hands goods from the counter's own store over the till; only
  // lines taken from another store need a pick ticket. Other sales: every
  // stocked line gets one, as before.
  const posOrder = await tx.posOrder.findUnique({
    where: { salesDocumentId: document.id },
    select: { register: { select: { storeId: true } } },
  })
  const counterStore = posOrder
    ? await posCounterStoreId(tx, ctx.orgId, posOrder.register.storeId)
    : undefined

  for (const line of packLines) {
    if (line.item?.type !== 'INVENTORY' || !line.storeId) continue
    if (!needsPickTicket(line.storeId, counterStore)) continue
    const cost = costByLine.get(line.id)
    const quantity = new Decimal(line.quantity.toString())
    if (quantity.lte(0)) continue

    const unitCost = cost?.unitCost ?? ZERO
    const value = cost?.value.abs() ?? ZERO
    const ticketNumber = await assignDocumentNumber(tx, ctx.orgId, 'STORE_TICKET')

    await tx.storeTicket.create({
      data: {
        orgId: ctx.orgId,
        number: ticketNumber,
        date: document.date,
        storeId: line.storeId,
        toStoreId: null,
        itemId: line.item.id,
        quantity: quantity.toFixed(4),
        unitCost: unitCost.toFixed(6),
        value: value.toFixed(4),
        takenBy,
        memo: `${document.type === 'INVOICE' ? 'Invoice' : 'Sales receipt'} ${document.number} · ${document.customer.displayName}`,
        origin: 'SALE',
        salesDocumentId: document.id,
        salesDocumentLineId: line.id,
        deliveryNoteId: noteId,
        createdById: ctx.userId,
      },
    })
  }

  return { id: noteId, number: noteNumber }
}

/** Soft-void notes and sale tickets when the sale is withdrawn. */
export async function voidForSale(tx: Tx, ctx: OrgContext, salesDocumentId: string, reason: string) {
  await tx.storeTicket.updateMany({
    where: { orgId: ctx.orgId, salesDocumentId, origin: 'SALE', status: 'POSTED' },
    data: { status: 'VOID' },
  })
  await tx.deliveryNote.updateMany({
    where: { orgId: ctx.orgId, salesDocumentId, status: 'POSTED' },
    data: {
      status: 'VOID',
      voidedAt: new Date(),
      voidReason: reason,
    },
  })
}

export async function updateNotes(
  ctx: OrgContext,
  id: string,
  input: { notes?: string | null; carrier?: string | null },
) {
  const note = await db.deliveryNote.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true },
  })
  if (!note) throw notFound('Delivery note')

  return db.deliveryNote.update({
    where: { id },
    data: {
      notes: input.notes?.trim() || null,
      carrier: input.carrier?.trim() || null,
    },
    select: { id: true, number: true },
  })
}

export async function overview(ctx: OrgContext) {
  const [posted, todayCount, weekRows] = await Promise.all([
    db.deliveryNote.count({ where: { orgId: ctx.orgId, status: 'POSTED' } }),
    db.deliveryNote.count({
      where: {
        orgId: ctx.orgId,
        status: 'POSTED',
        date: toDate(toCalendarDate(new Date())),
      },
    }),
    db.deliveryNote.findMany({
      where: { orgId: ctx.orgId, status: 'POSTED' },
      orderBy: [{ issuedAt: 'desc' }],
      take: 8,
      select: {
        id: true,
        number: true,
        date: true,
        issuedAt: true,
        customer: { select: { displayName: true } },
        salesDocument: { select: { number: true, type: true } },
        _count: { select: { lines: true } },
      },
    }),
  ])

  return {
    posted,
    today: todayCount,
    recent: weekRows.map((row) => ({
      id: row.id,
      number: row.number,
      date: toCalendarDate(row.date),
      issuedAt: row.issuedAt.toISOString(),
      customerName: row.customer.displayName,
      salesNumber: row.salesDocument.number,
      salesType: row.salesDocument.type,
      lineCount: row._count.lines,
      href: `/sales/delivery/${row.id}`,
    })),
  }
}

export async function list(
  ctx: OrgContext,
  options: { customerId?: string; status?: 'POSTED' | 'VOID' | 'all' } = {},
): Promise<DeliveryNoteListRow[]> {
  const status = options.status ?? 'POSTED'
  const rows = await db.deliveryNote.findMany({
    where: {
      orgId: ctx.orgId,
      ...(options.customerId ? { customerId: options.customerId } : {}),
      ...(status === 'all' ? {} : { status }),
    },
    orderBy: [{ date: 'desc' }, { issuedAt: 'desc' }],
    take: 500,
    select: {
      id: true,
      number: true,
      date: true,
      issuedAt: true,
      status: true,
      customerId: true,
      customer: { select: { displayName: true } },
      salesDocumentId: true,
      salesDocument: { select: { number: true, type: true } },
      store: { select: { name: true } },
      lines: { select: { quantity: true } },
    },
  })

  return rows.map((row) => {
    const quantity = row.lines.reduce((sum, line) => sum.plus(line.quantity.toString()), ZERO)
    return {
      id: row.id,
      number: row.number,
      date: toCalendarDate(row.date),
      issuedAt: row.issuedAt.toISOString(),
      customerId: row.customerId,
      customerName: row.customer.displayName,
      salesDocumentId: row.salesDocumentId,
      salesNumber: row.salesDocument.number,
      salesType: row.salesDocument.type,
      storeName: row.store?.name ?? null,
      lineCount: row.lines.length,
      quantity: quantity.toFixed(2),
      status: row.status,
      href: `/sales/delivery/${row.id}`,
      printHref: `/sales/delivery/${row.id}/print`,
    }
  })
}

export async function get(ctx: OrgContext, id: string): Promise<DeliveryNoteDetail> {
  const row = await db.deliveryNote.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      number: true,
      date: true,
      issuedAt: true,
      status: true,
      carrier: true,
      notes: true,
      customerId: true,
      customer: {
        select: {
          displayName: true,
          phone: true,
          email: true,
          shippingLine1: true,
          shippingLine2: true,
          shippingCity: true,
          shippingRegion: true,
          shippingPostalCode: true,
          shippingCountry: true,
          billingLine1: true,
          billingLine2: true,
          billingCity: true,
          billingRegion: true,
          billingPostalCode: true,
          billingCountry: true,
        },
      },
      salesDocumentId: true,
      salesDocument: { select: { number: true, type: true } },
      store: { select: { name: true } },
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          lineNumber: true,
          description: true,
          quantity: true,
          item: { select: { name: true } },
          storeId: true,
          salesDocumentLineId: true,
        },
      },
      tickets: {
        where: { status: 'POSTED' },
        select: {
          id: true,
          number: true,
          salesDocumentLineId: true,
          itemId: true,
        },
      },
    },
  })
  if (!row) throw notFound('Delivery note')

  const stores = await db.store.findMany({
    where: {
      orgId: ctx.orgId,
      id: { in: row.lines.map((l) => l.storeId).filter((id): id is string => Boolean(id)) },
    },
    select: { id: true, name: true },
  })
  const storeName = new Map(stores.map((s) => [s.id, s.name]))

  const ticketByLine = new Map(
    row.tickets
      .filter((t) => t.salesDocumentLineId)
      .map((t) => [t.salesDocumentLineId!, t] as const),
  )

  const c = row.customer
  const ship = [
    c.shippingLine1,
    c.shippingLine2,
    [c.shippingCity, c.shippingRegion, c.shippingPostalCode].filter(Boolean).join(' '),
    c.shippingCountry,
  ].filter(Boolean) as string[]
  const bill = [
    c.billingLine1,
    c.billingLine2,
    [c.billingCity, c.billingRegion, c.billingPostalCode].filter(Boolean).join(' '),
    c.billingCountry,
  ].filter(Boolean) as string[]

  const quantity = row.lines.reduce((sum, line) => sum.plus(line.quantity.toString()), ZERO)

  return {
    id: row.id,
    number: row.number,
    date: toCalendarDate(row.date),
    issuedAt: row.issuedAt.toISOString(),
    customerId: row.customerId,
    customerName: c.displayName,
    customerPhone: c.phone,
    customerEmail: c.email,
    shipping: ship.length > 0 ? ship : bill,
    salesDocumentId: row.salesDocumentId,
    salesNumber: row.salesDocument.number,
    salesType: row.salesDocument.type,
    storeName: row.store?.name ?? null,
    lineCount: row.lines.length,
    quantity: quantity.toFixed(2),
    status: row.status,
    carrier: row.carrier,
    notes: row.notes,
    href: `/sales/delivery/${row.id}`,
    printHref: `/sales/delivery/${row.id}/print`,
    lines: row.lines.map((line) => {
      const ticket = line.salesDocumentLineId
        ? ticketByLine.get(line.salesDocumentLineId)
        : undefined
      return {
        lineNumber: line.lineNumber,
        itemName: line.item?.name ?? null,
        description: line.description,
        quantity: new Decimal(line.quantity.toString()).toFixed(2),
        storeName: line.storeId ? storeName.get(line.storeId) ?? null : null,
        ticketNumber: ticket?.number ?? null,
        ticketId: ticket?.id ?? null,
      }
    }),
  }
}

export async function getTicket(ctx: OrgContext, id: string) {
  const ticket = await db.storeTicket.findFirst({
    where: { id, orgId: ctx.orgId },
    select: {
      id: true,
      number: true,
      date: true,
      quantity: true,
      unitCost: true,
      value: true,
      takenBy: true,
      memo: true,
      origin: true,
      status: true,
      createdAt: true,
      preparedAt: true,
      createdById: true,
      store: { select: { id: true, name: true } },
      toStore: { select: { id: true, name: true } },
      item: { select: { id: true, name: true, sku: true } },
      salesDocument: {
        select: {
          id: true,
          number: true,
          type: true,
          customer: { select: { displayName: true } },
        },
      },
      deliveryNote: { select: { id: true, number: true, notes: true } },
    },
  })
  if (!ticket) throw notFound('Store ticket')

  const seller = ticket.createdById
    ? await db.user.findFirst({
        where: { id: ticket.createdById },
        select: { name: true },
      })
    : null

  return {
    ...ticket,
    sellerName: seller?.name ?? null,
    customerName:
      ticket.takenBy ?? ticket.salesDocument?.customer.displayName ?? null,
  }
}

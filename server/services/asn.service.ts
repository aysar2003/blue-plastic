import 'server-only'

import { Decimal } from '@/lib/money'
import { toDate, today } from '@/lib/date'
import { canReceiveAsn, matchAsnToPoLines } from '@/lib/erp/verticals-p5'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'
import * as purchaseService from '@/server/services/purchase.service'

export async function listAsn(ctx: OrgContext) {
  return db.asnShipment.findMany({
    where: { orgId: ctx.orgId },
    include: {
      vendor: { select: { id: true, displayName: true } },
      purchaseDocument: { select: { id: true, number: true, type: true } },
      lines: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function createAsn(
  ctx: OrgContext,
  input: {
    vendorId: string
    number: string
    purchaseDocumentId?: string | null
    expectedAt?: string | null
    notes?: string | null
    lines: { itemId?: string | null; description: string; quantity: string }[]
  },
) {
  const vendor = await db.vendor.findFirst({
    where: { id: input.vendorId, orgId: ctx.orgId, isActive: true },
    select: { id: true },
  })
  if (!vendor) throw notFound('Vendor')

  const number = input.number.trim()
  if (!number) throw validation('ASN number is required.')
  if (!input.lines.length) throw validation('Add at least one ASN line.')

  if (input.purchaseDocumentId) {
    const po = await db.purchaseDocument.findFirst({
      where: {
        id: input.purchaseDocumentId,
        orgId: ctx.orgId,
        type: 'PURCHASE_ORDER',
      },
      select: { id: true },
    })
    if (!po) throw notFound('Purchase order')
  }

  const lineRows = input.lines.map((line) => {
    const quantity = new Decimal(line.quantity || '0')
    if (quantity.lessThanOrEqualTo(0)) {
      throw validation('ASN quantities must be more than zero.')
    }
    return {
      itemId: line.itemId || null,
      description: line.description.trim() || 'ASN line',
      quantity,
    }
  })

  try {
    return await db.asnShipment.create({
      data: {
        orgId: ctx.orgId,
        vendorId: vendor.id,
        number,
        purchaseDocumentId: input.purchaseDocumentId || null,
        expectedAt: input.expectedAt ? toDate(input.expectedAt) : null,
        notes: input.notes?.trim() || null,
        lines: { create: lineRows },
      },
      include: { lines: true },
    })
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : ''
    if (code === 'P2002') throw conflict('Another ASN already uses that number.')
    throw error
  }
}

/**
 * Receive an ASN into stock by posting a bill against the linked PO
 * (receiveOrder). Without a PO, receiving into stock is refused.
 */
export async function receiveAsn(ctx: OrgContext, asnId: string) {
  const asn = await db.asnShipment.findFirst({
    where: { id: asnId, orgId: ctx.orgId },
    include: { lines: true },
  })
  if (!asn) throw notFound('ASN')
  if (!canReceiveAsn(asn.status)) {
    throw precondition('Only an expected ASN can be received.')
  }
  if (!asn.purchaseDocumentId) {
    throw validation(
      'Link a purchase order on the ASN before receiving it into stock.',
    )
  }

  const order = await db.purchaseDocument.findFirst({
    where: {
      id: asn.purchaseDocumentId,
      orgId: ctx.orgId,
      type: 'PURCHASE_ORDER',
    },
    select: {
      id: true,
      number: true,
      lines: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true,
          itemId: true,
          quantity: true,
          quantityReceived: true,
        },
      },
    },
  })
  if (!order) throw notFound('Purchase order')

  const matched = matchAsnToPoLines({
    asnLines: asn.lines.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity.toString(),
    })),
    poLines: order.lines.map((line) => ({
      lineId: line.id,
      itemId: line.itemId,
      ordered: line.quantity.toString(),
      received: line.quantityReceived.toString(),
    })),
  })
  if (!matched.ok) throw validation(matched.message)

  const bill = await purchaseService.receiveOrder(ctx, {
    orderId: order.id,
    date: today(ctx.organization.timeZone),
    reference: asn.number,
    memo: `ASN ${asn.number} received against ${order.number}`,
    lines: matched.lines,
  })

  const updated = await db.asnShipment.updateMany({
    where: { id: asn.id, status: 'EXPECTED' },
    data: { status: 'RECEIVED' },
  })
  if (updated.count === 0) {
    throw conflict('This ASN was already received.')
  }

  return {
    asnId: asn.id,
    billId: bill.id,
    billNumber: bill.number,
    orderNumber: bill.orderNumber,
  }
}

/** @deprecated Prefer receiveAsn — kept for form name compatibility. */
export async function markAsnReceived(ctx: OrgContext, asnId: string) {
  return receiveAsn(ctx, asnId)
}

import 'server-only'

import { Decimal } from '@/lib/money'
import { today } from '@/lib/date'
import {
  canAddVisitCharge,
  canCancelVisit,
  canCloseVisit,
  claimsToCsv,
  visitChargeAmount,
  type ClaimExportRow,
  type PatientVisitStatus,
} from '@/lib/erp/hospital'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { conflict, notFound, precondition, validation } from '@/server/errors'
import * as salesService from '@/server/services/sales.service'

export async function listOpenVisits(ctx: OrgContext) {
  return db.patientVisit.findMany({
    where: { orgId: ctx.orgId, status: 'OPEN' },
    include: {
      customer: { select: { id: true, displayName: true } },
      trackingCategory: { select: { id: true, name: true } },
      charges: { select: { amount: true } },
    },
    orderBy: { openedAt: 'desc' },
    take: 200,
  })
}

export async function listRecentVisits(ctx: OrgContext) {
  return db.patientVisit.findMany({
    where: { orgId: ctx.orgId },
    include: {
      customer: { select: { id: true, displayName: true } },
      trackingCategory: { select: { id: true, name: true } },
      salesDocument: { select: { id: true, number: true, total: true } },
      charges: { select: { amount: true } },
    },
    orderBy: { openedAt: 'desc' },
    take: 100,
  })
}

export async function openVisit(
  ctx: OrgContext,
  input: {
    customerId: string
    trackingCategoryId?: string | null
    payerName?: string | null
    payerRef?: string | null
    notes?: string | null
  },
) {
  const customer = await db.customer.findFirst({
    where: { id: input.customerId, orgId: ctx.orgId, isActive: true },
    select: { id: true },
  })
  if (!customer) throw notFound('Patient / customer')

  if (input.trackingCategoryId) {
    const dept = await db.trackingCategory.findFirst({
      where: { id: input.trackingCategoryId, orgId: ctx.orgId, isActive: true },
      select: { id: true },
    })
    if (!dept) throw notFound('Department')
  }

  return db.patientVisit.create({
    data: {
      orgId: ctx.orgId,
      customerId: customer.id,
      trackingCategoryId: input.trackingCategoryId || null,
      payerName: input.payerName?.trim() || null,
      payerRef: input.payerRef?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  })
}

export async function addCharge(
  ctx: OrgContext,
  input: {
    visitId: string
    itemId?: string | null
    description: string
    quantity: string
    unitPrice: string
    billCode?: string | null
  },
) {
  const visit = await db.patientVisit.findFirst({
    where: { id: input.visitId, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!visit) throw notFound('Visit')
  if (!canAddVisitCharge(visit.status as PatientVisitStatus)) {
    throw precondition('Charges can only be added to an open visit.')
  }

  let itemId = input.itemId || null
  let description = input.description.trim()
  let unitPrice = input.unitPrice

  if (itemId) {
    const item = await db.item.findFirst({
      where: { id: itemId, orgId: ctx.orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true, salesPrice: true, sku: true },
    })
    if (!item) throw notFound('Service item')
    itemId = item.id
    if (!description) description = item.name
    if (!unitPrice.trim() && item.salesPrice != null) {
      unitPrice = item.salesPrice.toString()
    }
  }

  if (!description) throw validation('Charge description is required.')
  const quantity = new Decimal(input.quantity || '1')
  if (quantity.lessThanOrEqualTo(0)) throw validation('Quantity must be more than zero.')
  const price = new Decimal(unitPrice || '0')
  if (price.isNegative()) throw validation('Unit price cannot be negative.')
  const amount = visitChargeAmount(quantity.toString(), price.toString())

  return db.visitCharge.create({
    data: {
      visitId: visit.id,
      itemId,
      description,
      quantity,
      unitPrice: price,
      amount: new Decimal(amount),
      billCode: input.billCode?.trim() || null,
    },
  })
}

export async function closeVisit(ctx: OrgContext, visitId: string) {
  const visit = await db.patientVisit.findFirst({
    where: { id: visitId, orgId: ctx.orgId },
    include: {
      charges: true,
      customer: { select: { displayName: true } },
    },
  })
  if (!visit) throw notFound('Visit')
  if (visit.salesDocumentId) {
    throw precondition('This visit already has an invoice.')
  }
  if (
    !canCloseVisit({
      status: visit.status as PatientVisitStatus,
      chargeCount: visit.charges.length,
    })
  ) {
    throw precondition(
      visit.status !== 'OPEN'
        ? 'Only an open visit can be closed.'
        : 'Add at least one charge before closing the visit.',
    )
  }

  for (const charge of visit.charges) {
    if (!charge.itemId) {
      throw validation(`Charge “${charge.description}” needs a service item for invoicing.`)
    }
  }

  const lines = visit.charges.map((charge) => ({
    itemId: charge.itemId!,
    quantity: charge.quantity.toString(),
    unitPrice: charge.unitPrice.toString(),
    description: charge.description,
  }))

  const invoice = await salesService.create(ctx, 'INVOICE', {
    number: undefined,
    customerId: visit.customerId,
    date: today(ctx.organization.timeZone),
    trackingCategoryId: visit.trackingCategoryId ?? undefined,
    lines,
    saveAsDraft: false,
    acknowledgeCreditLimit: false,
    discountKind: 'percent',
    customerMessage: [
      `Patient visit`,
      visit.payerName ? `Payer: ${visit.payerName}` : null,
      visit.payerRef ? `Ref: ${visit.payerRef}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    memo: visit.notes ?? undefined,
  })

  const claimed = await db.patientVisit.updateMany({
    where: { id: visit.id, status: 'OPEN', salesDocumentId: null },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      salesDocumentId: invoice.id,
    },
  })
  if (claimed.count === 0) {
    await salesService.remove(ctx, invoice.id, 'Visit already closed by another request')
    throw conflict('This visit was already closed.')
  }
  await db.visitCharge.updateMany({
    where: { visitId: visit.id },
    data: { postedAt: new Date() },
  })

  return { invoiceId: invoice.id, invoiceNumber: invoice.number }
}

export async function cancelVisit(ctx: OrgContext, visitId: string) {
  const visit = await db.patientVisit.findFirst({
    where: { id: visitId, orgId: ctx.orgId },
    select: { id: true, status: true },
  })
  if (!visit) throw notFound('Visit')
  if (!canCancelVisit(visit.status as PatientVisitStatus)) {
    throw precondition('Only an open visit can be cancelled.')
  }
  return db.patientVisit.update({
    where: { id: visit.id },
    data: { status: 'CANCELLED', closedAt: new Date() },
  })
}

export async function exportClaims(
  ctx: OrgContext,
  options: { format: 'csv' | 'json'; status?: PatientVisitStatus } = { format: 'json' },
) {
  const visits = await db.patientVisit.findMany({
    where: {
      orgId: ctx.orgId,
      status: options.status ?? 'CLOSED',
    },
    include: {
      customer: { select: { displayName: true } },
      trackingCategory: { select: { name: true } },
      salesDocument: { select: { number: true } },
      charges: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { closedAt: 'desc' },
    take: 500,
  })

  const rows: ClaimExportRow[] = []
  for (const visit of visits) {
    for (const charge of visit.charges) {
      rows.push({
        visitId: visit.id,
        patientName: visit.customer.displayName,
        openedAt: visit.openedAt.toISOString(),
        closedAt: visit.closedAt?.toISOString() ?? null,
        payerName: visit.payerName,
        payerRef: visit.payerRef,
        department: visit.trackingCategory?.name ?? null,
        invoiceNumber: visit.salesDocument?.number ?? null,
        billCode: charge.billCode,
        description: charge.description,
        quantity: charge.quantity.toString(),
        unitPrice: charge.unitPrice.toString(),
        amount: charge.amount.toString(),
      })
    }
  }

  if (options.format === 'csv') {
    return { format: 'csv' as const, body: claimsToCsv(rows), rows }
  }
  return { format: 'json' as const, body: JSON.stringify({ claims: rows }, null, 2), rows }
}

export function visitBalance(charges: { amount: Decimal | string }[]): string {
  return charges
    .reduce((sum, charge) => sum.plus(new Decimal(charge.amount.toString())), new Decimal(0))
    .toFixed(2)
}

export async function hubStats(ctx: OrgContext) {
  const [open, closed] = await Promise.all([
    db.patientVisit.count({ where: { orgId: ctx.orgId, status: 'OPEN' } }),
    db.patientVisit.count({ where: { orgId: ctx.orgId, status: 'CLOSED' } }),
  ])
  return { open, closed }
}

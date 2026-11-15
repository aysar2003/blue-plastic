import 'server-only'

import { toCalendarDate } from '@/lib/date'
import { buildEInvoiceStub } from '@/lib/localization/packs'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import { notFound, precondition } from '@/server/errors'
import * as salesService from '@/server/services/sales.service'

const POSTED = new Set(['OPEN', 'PARTIAL', 'PAID'])

export async function buildPostedInvoiceEInvoice(ctx: OrgContext, documentId: string) {
  assertPermission(ctx, 'invoice:read')
  const document = await salesService.get(ctx, documentId)
  if (document.type !== 'INVOICE') throw precondition('E-invoice export is for posted invoices only.')
  if (!POSTED.has(document.status)) {
    throw precondition('Post the invoice before exporting the e-invoice stub.')
  }

  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    select: {
      name: true,
      taxRegistrationNumber: true,
      country: true,
      localizationPackId: true,
      baseCurrency: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      region: true,
      postalCode: true,
    },
  })
  if (!org) throw notFound('Organisation')

  const buyer = await db.customer.findFirst({
    where: { id: document.customer.id, orgId: ctx.orgId },
    select: {
      taxRegistrationNumber: true,
      billingCountry: true,
      billingLine1: true,
      billingLine2: true,
      billingCity: true,
      billingRegion: true,
    },
  })

  const json = buildEInvoiceStub(
    {
      name: org.name,
      taxRegistrationNumber: org.taxRegistrationNumber,
      country: org.country,
      localizationPackId: org.localizationPackId,
      addressLine1: org.addressLine1,
      addressLine2: org.addressLine2,
      city: org.city,
      region: org.region,
      postalCode: org.postalCode,
    },
    {
      number: document.number,
      date: toCalendarDate(document.date),
      customerName: document.customer.displayName,
      total: document.total.toString(),
      currencyCode: document.currencyCode || org.baseCurrency,
      subtotal: document.subtotal?.toString?.() ?? String(document.subtotal),
      taxTotal: document.taxTotal?.toString?.() ?? String(document.taxTotal),
      buyerTaxId: buyer?.taxRegistrationNumber ?? null,
      buyerCountry: buyer?.billingCountry ?? null,
      buyerAddress: buyer
        ? {
            line1: buyer.billingLine1,
            line2: buyer.billingLine2,
            city: buyer.billingCity,
            region: buyer.billingRegion,
          }
        : undefined,
      lines: document.lines.map((line) => ({
        sku: line.item?.sku ?? null,
        description: line.description ?? line.item?.name ?? '',
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        net: line.amount,
        taxAmount: line.taxAmount,
        taxCodeName: line.taxCode?.name ?? null,
      })),
    },
  )
  return { json, packId: org.localizationPackId, filename: `e-invoice-${document.number}.json` }
}

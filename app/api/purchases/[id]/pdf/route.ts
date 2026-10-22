import { NextResponse } from 'next/server'

import { letterheadOf } from '@/lib/letterhead'
import { parsePrintInk } from '@/lib/print-ink'
import { purchaseByType } from '@/lib/purchase-types'
import { getOrgContext } from '@/server/auth/context'
import { forbidden, isAppError, unauthenticated } from '@/server/errors'
import { renderSalesDocumentPdf } from '@/server/reports/sales-document-pdf'
import * as organizationService from '@/server/services/organization.service'
import * as purchaseService from '@/server/services/purchase.service'

export const dynamic = 'force-dynamic'

/** Purchase document as a downloadable PDF — bill, expense, credit, or order. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()
    if (ctx.portalCustomerId || !ctx.permissions.has('bill:read')) throw forbidden()

    const ink = parsePrintInk(new URL(request.url).searchParams.get('ink'))

    const [rows, org, template] = await Promise.all([
      purchaseService.getMany(ctx, [id]),
      organizationService.get(ctx),
      organizationService.getDocumentTemplate(ctx),
    ])
    const document = rows[0]
    if (!document) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Document not found.' } }, { status: 404 })
    }

    const config = purchaseByType(document.type)
    const company = letterheadOf(org)
    const currency = document.currencyCode || ctx.organization.baseCurrency

    const bytes = renderSalesDocumentPdf({
      ink,
      template,
      partyLabel: 'Vendor',
      paper: 'vendor',
      orgName: company.name,
      orgAddress: company.address ? [company.address] : [],
      orgPhone: company.phone,
      orgEmail: company.email,
      title: config.singular,
      documentType: document.type,
      number: document.number,
      date: document.date,
      createdAt: document.createdAt,
      timeZone: org.timeZone,
      dueDate: document.dueDate,
      customerName: document.customer.displayName,
      customerAddress: [
        document.customer.billingLine1,
        document.customer.billingLine2,
        document.customer.billingCity,
        document.customer.billingRegion,
      ].filter((part): part is string => Boolean(part)),
      customerEmail: document.customer.email,
      customerPhone: document.customer.phone,
      reference: document.reference,
      paymentTerm: document.paymentTerm?.name ?? null,
      status: document.status,
      createdByName: document.createdByName,
      currency,
      lines: document.lines.map((line) => ({
        quantity: line.quantity,
        sku: line.item?.sku ?? null,
        description: line.description ?? line.item?.name ?? 'Line',
        unitPrice: line.unitPrice,
        amount: line.amount,
        unitOfMeasure: line.item?.unitOfMeasure ?? null,
      })),
      subtotal: document.subtotal,
      discountAmount: document.discountAmount,
      taxTotal: document.taxTotal,
      total: document.total,
      amountApplied: document.amountApplied,
      balance: document.balance,
    })

    const filename = `${config.slug.replace(/s$/, '')}-${document.number
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.pdf`

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      )
    }
    console.error('[api/purchases/pdf]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}

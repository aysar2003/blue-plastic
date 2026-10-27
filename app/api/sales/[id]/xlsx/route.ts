import { NextResponse } from 'next/server'

import { letterheadOf } from '@/lib/letterhead'
import { byType } from '@/lib/sales-types'
import { getOrgContext } from '@/server/auth/context'
import { isAppError, unauthenticated } from '@/server/errors'
import { renderDocumentXlsx } from '@/server/reports/document-xlsx'
import * as organizationService from '@/server/services/organization.service'
import * as portalService from '@/server/services/portal.service'
import * as salesService from '@/server/services/sales.service'

export const dynamic = 'force-dynamic'

/** Sales document as a downloadable Excel workbook (.xlsx). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()

    const [document, org] = await Promise.all([
      salesService.get(ctx, id),
      organizationService.get(ctx),
    ])

    portalService.assertInvoicePdfAccess(ctx, document.customer.id)

    const config = byType(document.type)
    const company = letterheadOf(org)
    const currency = document.currencyCode || ctx.organization.baseCurrency

    const bytes = await renderDocumentXlsx({
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
      workScope: document.workScope,
      workSite: document.workSite || document.project?.siteLocation || null,
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
      message: document.customerMessage,
    })

    const filename = `${config.slug.replace(/s$/, '')}-${document.number
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.xlsx`

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
    console.error('[api/sales/xlsx]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}

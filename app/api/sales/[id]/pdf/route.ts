import { NextResponse } from 'next/server'

import { letterheadOf } from '@/lib/letterhead'
import { byType } from '@/lib/sales-types'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { renderSalesDocumentPdf } from '@/server/reports/sales-document-pdf'
import * as organizationService from '@/server/services/organization.service'
import * as salesService from '@/server/services/sales.service'

export const dynamic = 'force-dynamic'

/** Sales document as a downloadable PDF — invoice, quotation, receipt, or credit. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const ctx = await requireOrgContext('invoice:read')
    const [document, org] = await Promise.all([
      salesService.get(ctx, id),
      organizationService.get(ctx),
    ])
    const config = byType(document.type)
    const company = letterheadOf(org)
    const currency = document.currencyCode || ctx.organization.baseCurrency

    const bytes = renderSalesDocumentPdf({
      orgName: company.name,
      orgAddress: company.address ? [company.address] : [],
      orgPhone: company.phone,
      orgEmail: company.email,
      title: config.singular,
      number: document.number,
      date: document.date,
      dueDate: document.dueDate,
      customerName: document.customer.displayName,
      customerAddress: [document.customer.billingLine1, document.customer.billingCity].filter(
        (part): part is string => Boolean(part),
      ),
      customerEmail: document.customer.email,
      currency,
      lines: document.lines.map((line) => ({
        quantity: line.quantity,
        sku: line.item?.sku ?? null,
        description: line.description ?? line.item?.name ?? 'Line',
        unitPrice: line.unitPrice,
        amount: line.amount,
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
    console.error('[api/sales/pdf]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}

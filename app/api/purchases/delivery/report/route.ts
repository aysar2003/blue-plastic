import { NextResponse } from 'next/server'

import { letterheadOf } from '@/lib/letterhead'
import { parsePrintInk } from '@/lib/print-ink'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { renderDeliveryReportPdf } from '@/server/reports/delivery-report-pdf'
import * as delivery from '@/server/services/delivery.service'
import * as organizationService from '@/server/services/organization.service'

export const dynamic = 'force-dynamic'

/**
 * Delivery report as a PDF — same filters as the screen (outstanding / delivered / all).
 */
export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('bill:read')
    const url = new URL(request.url)
    const ink = parsePrintInk(url.searchParams.get('ink'))
    const filterRaw = url.searchParams.get('filter') ?? ''
    const filter =
      filterRaw === 'outstanding' || filterRaw === 'delivered' ? filterRaw : 'all'
    const vendorId = url.searchParams.get('vendorId') ?? undefined

    const [orders, org, template] = await Promise.all([
      delivery.detailReport(ctx, { filter, vendorId }),
      organizationService.get(ctx),
      organizationService.getPrintTemplate(ctx, url.searchParams.get('paper')),
    ])

    const filterLabel =
      filter === 'outstanding'
        ? 'Outstanding orders'
        : filter === 'delivered'
          ? 'Delivered orders'
          : 'All purchase orders'

    const company = letterheadOf(org)
    const bytes = renderDeliveryReportPdf({
      orgName: company.name,
      orgAddress: company.address ? [company.address] : [],
      orgPhone: company.phone,
      orgEmail: company.email,
      currency: ctx.organization.baseCurrency,
      filterLabel,
      orders,
      ink,
      template,
    })

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="delivery-report.pdf"`,
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
    console.error('[api/purchases/delivery/report]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}

import { NextResponse } from 'next/server'

import { letterheadOf } from '@/lib/letterhead'
import { parsePrintInk } from '@/lib/print-ink'
import { formatQty } from '@/lib/quantity'
import { getOrgContext } from '@/server/auth/context'
import { isAppError, unauthenticated } from '@/server/errors'
import { renderStoreTicketPdf } from '@/server/reports/store-ticket-pdf'
import * as organizationService from '@/server/services/organization.service'
import * as salesDelivery from '@/server/services/sales-delivery.service'

export const dynamic = 'force-dynamic'

/** Store ticket PDF — merchant paper matching Print. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()

    const ink = parsePrintInk(new URL(request.url).searchParams.get('ink'))
    const [ticket, org, template] = await Promise.all([
      salesDelivery.getTicket(ctx, id),
      organizationService.get(ctx),
      organizationService.getPrintTemplate(ctx, new URL(request.url).searchParams.get('paper')),
    ])

    const company = letterheadOf(org)
    const originLabel =
      ticket.origin === 'SALE' ? 'Sale issue' : ticket.origin === 'MANUAL' ? 'Manual ticket' : 'Transfer'

    const bytes = renderStoreTicketPdf({
      ink,
      template,
      orgName: company.name,
      orgAddress: company.address ? [company.address] : [],
      orgPhone: company.phone,
      orgEmail: company.email,
      number: ticket.number,
      date: ticket.date,
      createdAt: ticket.createdAt,
      timeZone: org.timeZone,
      originLabel,
      itemName: ticket.item.name,
      quantity: formatQty(ticket.quantity.toString(), ticket.item.unitOfMeasure),
      storeName: ticket.store.name,
      toStoreName: ticket.toStore?.name ?? null,
      customerName: ticket.customerName,
      salesNumber: ticket.salesDocument?.number ?? null,
      deliveryNumber: ticket.deliveryNote?.number ?? null,
      sellerName: ticket.sellerName,
    })

    const filename = `ticket-${ticket.number.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
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
    console.error('[api/stores/tickets/pdf]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}

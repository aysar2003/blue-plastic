import { NextResponse } from 'next/server'

import { letterheadOf } from '@/lib/letterhead'
import { parsePrintInk } from '@/lib/print-ink'
import { getOrgContext } from '@/server/auth/context'
import { isAppError, unauthenticated } from '@/server/errors'
import { renderDeliveryNotePdf } from '@/server/reports/delivery-note-pdf'
import * as organizationService from '@/server/services/organization.service'
import * as salesDelivery from '@/server/services/sales-delivery.service'

export const dynamic = 'force-dynamic'

/** Delivery note as a downloadable PDF — same merchant paper as Print. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()

    const ink = parsePrintInk(new URL(request.url).searchParams.get('ink'))
    const [note, org, template] = await Promise.all([
      salesDelivery.get(ctx, id),
      organizationService.get(ctx),
      organizationService.getDocumentTemplate(ctx),
    ])

    const company = letterheadOf(org)
    const bytes = renderDeliveryNotePdf({
      ink,
      template,
      orgName: company.name,
      orgAddress: company.address ? [company.address] : [],
      orgPhone: company.phone,
      orgEmail: company.email,
      number: note.number,
      date: note.date,
      issuedAt: new Date(note.issuedAt),
      timeZone: org.timeZone,
      customerName: note.customerName,
      shipping: note.shipping,
      customerPhone: note.customerPhone,
      salesNumber: note.salesNumber,
      storeName: note.storeName,
      carrier: note.carrier,
      notes: note.notes,
      lines: note.lines.map((line) => ({
        lineNumber: line.lineNumber,
        itemName: line.itemName,
        description: line.description,
        storeName: line.storeName,
        quantity: String(line.quantity),
        ticketNumber: line.ticketNumber,
      })),
    })

    const filename = `delivery-note-${note.number.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
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
    console.error('[api/sales/delivery/pdf]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}

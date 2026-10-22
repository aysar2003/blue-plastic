import { NextResponse } from 'next/server'

import { letterheadOf } from '@/lib/letterhead'
import { parsePrintInk } from '@/lib/print-ink'
import { purchaseBySlug } from '@/lib/purchase-types'
import { getOrgContext } from '@/server/auth/context'
import { forbidden, isAppError, unauthenticated } from '@/server/errors'
import { renderDocumentPackPdf, salesDetailToPdfInput } from '@/server/reports/sales-document-pdf'
import * as organizationService from '@/server/services/organization.service'
import { loadPurchasePack } from '@/server/services/document-pack.service'

export const dynamic = 'force-dynamic'

/** Several purchase papers as one PDF — original sheets, oldest first. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  try {
    const { type } = await params
    const config = purchaseBySlug(type)
    if (!config) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Unknown list.' } }, { status: 404 })
    }

    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()
    if (ctx.portalCustomerId || !ctx.permissions.has('bill:read')) throw forbidden()

    const url = new URL(request.url)
    const ink = parsePrintInk(url.searchParams.get('ink'))
    const [documents, org, template] = await Promise.all([
      loadPurchasePack(ctx, config.type, url.searchParams),
      organizationService.get(ctx),
      organizationService.getDocumentTemplate(ctx),
    ])

    const company = letterheadOf(org)
    const shared = {
      ink,
      template,
      orgName: company.name,
      orgAddress: company.address ? [company.address] : [],
      orgPhone: company.phone,
      orgEmail: company.email,
      timeZone: org.timeZone,
    }
    const bytes = renderDocumentPackPdf({
      ink,
      documents: documents.map((document) =>
        salesDetailToPdfInput(document, shared, { partyLabel: 'Vendor', paper: 'vendor' }),
      ),
    })

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${config.slug}-pack.pdf"`,
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
    console.error('[api/purchases/pack/pdf]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}

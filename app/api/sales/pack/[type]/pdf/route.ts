import { NextResponse } from 'next/server'

import { letterheadOf } from '@/lib/letterhead'
import { parsePaperMetaHidden } from '@/lib/paper-meta-fields'
import { parsePrintInk } from '@/lib/print-ink'
import { isProposal, bySlug } from '@/lib/sales-types'
import { getOrgContext } from '@/server/auth/context'
import { isAppError, unauthenticated } from '@/server/errors'
import { renderDocumentPackPdf, salesDetailToPdfInput } from '@/server/reports/sales-document-pdf'
import { screenPaperResponse } from '@/server/reports/screen-pdf'
import * as approvalService from '@/server/services/approval.service'
import * as organizationService from '@/server/services/organization.service'
import { loadSalesPack } from '@/server/services/document-pack.service'

export const dynamic = 'force-dynamic'

/** Several sales papers as one PDF — original sheets, oldest first. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  try {
    const { type } = await params
    const config = bySlug(type)
    if (!config) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Unknown list.' } }, { status: 404 })
    }

    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()

    const url = new URL(request.url)
    const ink = parsePrintInk(url.searchParams.get('ink'))
    const hiddenMeta = parsePaperMetaHidden(url.searchParams.get('meta'))
    const [documents, org, template] = await Promise.all([
      loadSalesPack(ctx, config.type, url.searchParams),
      organizationService.get(ctx),
      organizationService.getPrintTemplate(ctx, url.searchParams.get('paper')),
    ])

    const company = letterheadOf(org)
    const origin = new URL(request.url).origin
    const screen = await screenPaperResponse(
      `${origin}/sales/${config.slug}/pack/print${url.search}`,
      request.headers.get('cookie') ?? '',
      `${config.slug}-pack.pdf`,
    )
    if (screen) return screen

    const shared = {
      ink,
      template,
      orgName: company.name,
      orgAddress: company.address ? [company.address] : [],
      orgPhone: company.phone,
      orgEmail: company.email,
      timeZone: org.timeZone,
    }
    const approvals = await approvalService.latestApprovals(
      ctx.orgId,
      documents.map((document) => document.id),
    )
    const bytes = renderDocumentPackPdf({
      ink,
      runningTotals: isProposal(config.type),
      documents: documents.map((document) =>
        salesDetailToPdfInput(
          {
            ...document,
            approvedByName: approvals.get(document.id)?.name ?? null,
            approvedAt: approvals.get(document.id)?.at ?? null,
          },
          shared,
          { hiddenMeta },
        ),
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
    console.error('[api/sales/pack/pdf]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}

import { NextResponse } from 'next/server'

import { getOrgContext } from '@/server/auth/context'
import { forbidden, isAppError, unauthenticated } from '@/server/errors'
import * as companyAgreementService from '@/server/services/company-agreement.service'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; agreementId: string }> },
) {
  try {
    const { orgId, agreementId } = await params
    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()
    if (!ctx.isSystemOwner) throw forbidden()

    const file = await companyAgreementService.download(ctx, { orgId, agreementId })
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename="${file.originalName.replace(/"/g, '')}"`,
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
    console.error('[api/databases/agreements/file]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}

import { NextResponse } from 'next/server'

import { parsePrintInk } from '@/lib/print-ink'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as trashService from '@/server/services/trash.service'

export const dynamic = 'force-dynamic'

/** PDF for a trash entry — the original form when it can be rebuilt, else a short sheet. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const ctx = await requireOrgContext('audit:read')
    const url = new URL(request.url)
    const ink = parsePrintInk(url.searchParams.get('ink'))
    const { bytes, filename } = await trashService.renderPdf(ctx, id, { ink })
    const download = url.searchParams.get('download') === '1'

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
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
    console.error('[api/trash/pdf]', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Request failed.' } },
      { status: 500 },
    )
  }
}

import { NextResponse } from 'next/server'

import { getOrgContext } from '@/server/auth/context'
import { isAppError, unauthenticated } from '@/server/errors'
import * as eInvoiceExport from '@/server/services/e-invoice-export.service'

export const dynamic = 'force-dynamic'

/** JSON e-invoice stub using the organisation localization pack (Phase 40 deepen). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getOrgContext()
    if (!ctx) throw unauthenticated()

    const { json, filename } = await eInvoiceExport.buildPostedInvoiceEInvoice(ctx, id)
    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[e-invoice]', error)
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 })
  }
}
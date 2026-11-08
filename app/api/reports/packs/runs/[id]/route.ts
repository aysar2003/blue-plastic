import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { decodePackXlsxBody, xlsxResponse } from '@/server/reports/list-xlsx'
import * as reportPackService from '@/server/services/report-pack.service'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await requireOrgContext('report:read')
    const run = await reportPackService.getRun(ctx, id)
    const baseName = `${run.pack.name.replace(/[^\w.-]+/g, '_')}-${run.toDate}`
    const xlsx = decodePackXlsxBody(run.body)
    if (xlsx) {
      return xlsxResponse(`${baseName}.xlsx`, xlsx)
    }
    // Legacy runs stored a combined CSV body.
    return new Response(run.body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${baseName}.csv"`,
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
    console.error('[report-pack-run]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Failed.' } }, { status: 500 })
  }
}

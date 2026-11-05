import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as reportPackService from '@/server/services/report-pack.service'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await requireOrgContext('report:read')
    const run = await reportPackService.getRun(ctx, id)
    const filename = `${run.pack.name.replace(/[^\w.-]+/g, '_')}-${run.toDate}.csv`
    return new Response(run.body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
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
    console.error('[report-pack-run]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Failed.' } }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as statutoryExport from '@/server/services/statutory-export.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('report:read')
    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv'
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: 'from and to (YYYY-MM-DD) are required.' }, { status: 400 })
    }
    const pack = await statutoryExport.vatReturnExport(ctx, { from, to })
    if (pack.disabled) {
      return NextResponse.json({ error: 'Tax is turned off for this company.' }, { status: 400 })
    }
    if (format === 'json') {
      return new Response(pack.json, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="vat-return-${to}.json"`,
          'Cache-Control': 'no-store',
        },
      })
    }
    return new Response(pack.csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="vat-return-${to}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[vat-return]', error)
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as statutoryExport from '@/server/services/statutory-export.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('hr:payroll')
    const url = new URL(request.url)
    const from = url.searchParams.get('from') ?? `${new Date().getFullYear()}-01-01`
    const to = url.searchParams.get('to') ?? `${new Date().getFullYear()}-12-31`
    const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: 'Invalid dates.' }, { status: 400 })
    }
    const pack = await statutoryExport.payrollStatutoryExport(ctx, { from, to })
    if (format === 'json') {
      return new Response(pack.json, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="payroll-statutory-${to}.json"`,
          'Cache-Control': 'no-store',
        },
      })
    }
    return new Response(pack.csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payroll-statutory-${to}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[payroll-statutory]', error)
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 })
  }
}

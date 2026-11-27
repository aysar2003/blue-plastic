import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import * as withholdingService from '@/server/services/withholding.service'

/** Wave G: WHT remittance CSV (no government e-filing). */
export async function GET(request: Request) {
  const ctx = await requireOrgContext('bill:read')
  const url = new URL(request.url)
  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined
  const result = await withholdingService.listWithholdRemittance(ctx, { from, to })
  return new NextResponse(result.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="wht-remittance.csv"',
    },
  })
}

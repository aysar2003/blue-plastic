import { NextResponse } from 'next/server'

import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { buildOwnersEquityWorkbook } from '@/server/services/equity-owners.service'

export const dynamic = 'force-dynamic'

/**
 * Owners / capital accounts workbook for distributing retained earnings.
 * Fill Amount to allocate, then import on Periods.
 */
export async function GET() {
  try {
    const ctx = await requireOrgContext('journal:post')
    const bytes = await buildOwnersEquityWorkbook(ctx)
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="owners-equity.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status })
    }
    console.error('[api/exports/owners-equity]', error)
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Request failed.' } }, { status: 500 })
  }
}

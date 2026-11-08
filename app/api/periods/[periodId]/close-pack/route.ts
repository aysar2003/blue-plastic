import { NextResponse } from 'next/server'

import { toCalendarDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { db } from '@/server/db'
import { xlsxResponse } from '@/server/reports/list-xlsx'
import * as closePack from '@/server/services/close-pack.service'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  context: { params: Promise<{ periodId: string }> },
) {
  try {
    const ctx = await requireOrgContext('report:export')
    const { periodId } = await context.params
    const period = await db.accountingPeriod.findFirst({
      where: { id: periodId, orgId: ctx.orgId },
      select: { id: true, startDate: true, endDate: true },
    })
    if (!period) {
      return NextResponse.json({ error: 'Period not found.' }, { status: 404 })
    }
    const pack = await closePack.buildClosePack(ctx, {
      from: toCalendarDate(period.startDate),
      to: toCalendarDate(period.endDate),
    })
    return xlsxResponse(pack.filename, pack.body)
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[close-pack]', error)
    return NextResponse.json({ error: 'Close pack failed.' }, { status: 500 })
  }
}

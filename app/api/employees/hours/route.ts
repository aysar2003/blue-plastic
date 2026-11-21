import { NextResponse } from 'next/server'

import { hoursFileCsv } from '@/lib/erp/hours-export'
import { today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as attendanceService from '@/server/services/attendance.service'
import * as hrSettingsService from '@/server/services/hr-settings.service'
import * as leaveService from '@/server/services/leave.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('hr:read')
    const url = new URL(request.url)
    const kind = url.searchParams.get('kind') ?? 'all'
    const to = url.searchParams.get('to') ?? today(ctx.organization.timeZone)
    const from = url.searchParams.get('from') ?? `${to.slice(0, 4)}-01-01`
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: 'Invalid dates.' }, { status: 400 })
    }
    const settings = await hrSettingsService.get(ctx)
    const leave =
      kind === 'attendance'
        ? []
        : await leaveService.exportHours(ctx, { from, to }, settings.hoursPerDay)
    const attendance = kind === 'leave' ? [] : await attendanceService.exportHours(ctx, { from, to })
    const csv = hoursFileCsv([...leave, ...attendance])
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="hours-${kind}-${to}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[hours-export]', error)
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 })
  }
}

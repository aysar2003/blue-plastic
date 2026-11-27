import { NextResponse } from 'next/server'

import { today } from '@/lib/date'
import { HOURS_HEADERS } from '@/lib/erp/export-headers'
import { hoursFileTableRows } from '@/lib/erp/hours-export'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import {
  preparedListResponse,
  readExportFormat,
} from '@/server/reports/prepared-list-export'
import * as attendanceService from '@/server/services/attendance.service'
import * as hrSettingsService from '@/server/services/hr-settings.service'
import * as leaveService from '@/server/services/leave.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('hr:read')
    const url = new URL(request.url)
    const format = readExportFormat(url, 'xlsx')
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
    return preparedListResponse({
      org: ctx.organization,
      title: 'Hours export',
      subtitle: `${kind} · ${from} to ${to}`,
      filenameBase: `hours-${kind}-${to}`,
      format,
      columns: [
        { header: HOURS_HEADERS[0], width: 12, kind: 'date' },
        { header: HOURS_HEADERS[1], width: 28 },
        { header: HOURS_HEADERS[2], width: 12 },
        { header: HOURS_HEADERS[3], width: 12, kind: 'number' },
        { header: HOURS_HEADERS[4], width: 36 },
      ],
      rows: hoursFileTableRows([...leave, ...attendance]),
    })
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[hours-export]', error)
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 })
  }
}

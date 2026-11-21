import { isCalendarDate, type CalendarDate } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as equityService from '@/server/services/equity-register.service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('account:read')
    const url = new URL(request.url)
    const fromRaw = url.searchParams.get('from')
    const toRaw = url.searchParams.get('to')
    const from = fromRaw && isCalendarDate(fromRaw) ? (fromRaw as CalendarDate) : null
    const to = toRaw && isCalendarDate(toRaw) ? (toRaw as CalendarDate) : null
    const csv = await equityService.periodEquityMovementExport(ctx, { from, to })
    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="equity-movement.csv"',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    return Response.json({ error: 'Export failed.' }, { status: 500 })
  }
}

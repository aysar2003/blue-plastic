import { isCalendarDate, today } from '@/lib/date'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as franchise from '@/server/services/franchise.service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('report:read')
    const url = new URL(request.url)
    const monthRaw = url.searchParams.get('month')
    const month =
      monthRaw && isCalendarDate(monthRaw.slice(0, 10))
        ? monthRaw.slice(0, 10)
        : `${today(ctx.organization.timeZone).slice(0, 7)}-01`
    const csv = await franchise.royaltyStatementCsvExport(ctx, month)
    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="franchise-royalty.csv"',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    return Response.json({ error: 'Export failed.' }, { status: 500 })
  }
}

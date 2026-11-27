import { isCalendarDate, today } from '@/lib/date'
import { ROYALTY_HEADERS } from '@/lib/erp/export-headers'
import { royaltyStatementTableRows } from '@/lib/erp/franchise'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import {
  preparedListResponse,
  readExportFormat,
} from '@/server/reports/prepared-list-export'
import * as franchise from '@/server/services/franchise.service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('report:read')
    const url = new URL(request.url)
    const format = readExportFormat(url, 'xlsx')
    const monthRaw = url.searchParams.get('month')
    const month =
      monthRaw && isCalendarDate(monthRaw.slice(0, 10))
        ? monthRaw.slice(0, 10)
        : `${today(ctx.organization.timeZone).slice(0, 7)}-01`
    const rows = await franchise.royaltyStatementRows(ctx, month)
    return preparedListResponse({
      org: ctx.organization,
      title: 'Franchise royalty',
      subtitle: `Month starting ${month}`,
      currency: ctx.organization.baseCurrency,
      filenameBase: 'franchise-royalty',
      format,
      columns: [
        { header: ROYALTY_HEADERS[0], width: 28 },
        { header: ROYALTY_HEADERS[1], width: 12, kind: 'number' },
        { header: ROYALTY_HEADERS[2], width: 14, kind: 'money' },
        { header: ROYALTY_HEADERS[3], width: 14, kind: 'money' },
      ],
      rows: royaltyStatementTableRows(rows),
    })
  } catch (error) {
    if (isAppError(error)) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    return Response.json({ error: 'Export failed.' }, { status: 500 })
  }
}

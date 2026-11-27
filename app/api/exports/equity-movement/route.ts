import { isCalendarDate, type CalendarDate } from '@/lib/date'
import { EQUITY_MOVEMENT_HEADERS } from '@/lib/erp/export-headers'
import { equityMovementTableRows } from '@/lib/erp/equity-csv'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import {
  preparedListResponse,
  readExportFormat,
} from '@/server/reports/prepared-list-export'
import * as equityService from '@/server/services/equity-register.service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('account:read')
    const url = new URL(request.url)
    const format = readExportFormat(url, 'xlsx')
    const fromRaw = url.searchParams.get('from')
    const toRaw = url.searchParams.get('to')
    const from = fromRaw && isCalendarDate(fromRaw) ? (fromRaw as CalendarDate) : null
    const to = toRaw && isCalendarDate(toRaw) ? (toRaw as CalendarDate) : null
    const rows = await equityService.periodEquityMovementRows(ctx, { from, to })
    return preparedListResponse({
      org: ctx.organization,
      title: 'Equity movement',
      subtitle: from || to ? `${from ?? '…'} to ${to ?? '…'}` : undefined,
      currency: ctx.organization.baseCurrency,
      filenameBase: 'equity-movement',
      format,
      columns: [
        { header: EQUITY_MOVEMENT_HEADERS[0], width: 12, kind: 'date' },
        { header: EQUITY_MOVEMENT_HEADERS[1], width: 14 },
        { header: EQUITY_MOVEMENT_HEADERS[2], width: 24 },
        { header: EQUITY_MOVEMENT_HEADERS[3], width: 14, kind: 'money' },
        { header: EQUITY_MOVEMENT_HEADERS[4], width: 28 },
        { header: EQUITY_MOVEMENT_HEADERS[5], width: 28 },
      ],
      rows: equityMovementTableRows(rows),
    })
  } catch (error) {
    if (isAppError(error)) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    return Response.json({ error: 'Export failed.' }, { status: 500 })
  }
}

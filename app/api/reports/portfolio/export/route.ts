import { PORTFOLIO_HEADERS } from '@/lib/erp/export-headers'
import { portfolioTableRows } from '@/lib/erp/portfolio'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import { portfolioReport } from '@/server/reports/portfolio'
import {
  preparedListResponse,
  readExportFormat,
} from '@/server/reports/prepared-list-export'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const ctx = await requireOrgContext('report:read')
    const format = readExportFormat(new URL(request.url), 'xlsx')
    const report = await portfolioReport(ctx)
    return preparedListResponse({
      org: ctx.organization,
      title: 'Portfolio subsidiaries',
      currency: ctx.organization.baseCurrency,
      filenameBase: 'portfolio',
      format,
      columns: [
        { header: PORTFOLIO_HEADERS[0], width: 26 },
        { header: PORTFOLIO_HEADERS[1], width: 28 },
        { header: PORTFOLIO_HEADERS[2], width: 14, kind: 'number' },
        { header: PORTFOLIO_HEADERS[3], width: 16, kind: 'money' },
        { header: PORTFOLIO_HEADERS[4], width: 14, kind: 'money' },
      ],
      rows: portfolioTableRows(report.subsidiaries),
    })
  } catch (error) {
    if (isAppError(error)) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    return Response.json({ error: 'Export failed.' }, { status: 500 })
  }
}

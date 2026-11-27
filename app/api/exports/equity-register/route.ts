import { SHAREHOLDER_REGISTER_HEADERS } from '@/lib/erp/export-headers'
import { shareholderRegisterTableRows } from '@/lib/erp/equity-csv'
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
    const format = readExportFormat(new URL(request.url), 'xlsx')
    const rows = await equityService.shareholderRegisterRows(ctx)
    return preparedListResponse({
      org: ctx.organization,
      title: 'Shareholder register',
      filenameBase: 'shareholder-register',
      format,
      columns: [
        { header: SHAREHOLDER_REGISTER_HEADERS[0], width: 28 },
        { header: SHAREHOLDER_REGISTER_HEADERS[1], width: 12, kind: 'number' },
        { header: SHAREHOLDER_REGISTER_HEADERS[2], width: 14, kind: 'number' },
        { header: SHAREHOLDER_REGISTER_HEADERS[3], width: 28 },
      ],
      rows: shareholderRegisterTableRows(rows),
    })
  } catch (error) {
    if (isAppError(error)) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    return Response.json({ error: 'Export failed.' }, { status: 500 })
  }
}

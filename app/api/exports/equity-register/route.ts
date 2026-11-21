import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as equityService from '@/server/services/equity-register.service'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const ctx = await requireOrgContext('account:read')
    const csv = await equityService.shareholderRegisterExport(ctx)
    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="shareholder-register.csv"',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    return Response.json({ error: 'Export failed.' }, { status: 500 })
  }
}

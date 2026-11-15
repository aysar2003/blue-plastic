import { portfolioReport } from '@/server/reports/portfolio'
import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const ctx = await requireOrgContext('report:read')
    const report = await portfolioReport(ctx)
    return new Response(report.csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="portfolio.csv"',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    return Response.json({ error: 'Export failed.' }, { status: 500 })
  }
}
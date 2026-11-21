import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as setupHealthService from '@/server/services/setup-health.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = await requireOrgContext('org:read')
    const gaps = await setupHealthService.listSetupHealthGaps(ctx)
    const csv = setupHealthService.setupHealthGapsCsv(gaps)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="setup-heal-report.csv"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (isAppError(error)) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    throw error
  }
}

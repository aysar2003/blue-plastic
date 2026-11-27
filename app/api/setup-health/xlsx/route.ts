import { requireOrgContext } from '@/server/auth/context'
import { isAppError } from '@/server/errors'
import * as setupHealthService from '@/server/services/setup-health.service'

export const dynamic = 'force-dynamic'

/** Prepared multi-sheet heal workbook (summary, suggested SKUs, gap sheets). */
export async function GET() {
  try {
    const ctx = await requireOrgContext('org:read')
    const gaps = await setupHealthService.listSetupHealthGaps(ctx)
    const body = await setupHealthService.setupHealthGapsXlsx(ctx, gaps)
    return setupHealthService.setupHealthXlsxResponse(body)
  } catch (error) {
    if (isAppError(error)) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    throw error
  }
}

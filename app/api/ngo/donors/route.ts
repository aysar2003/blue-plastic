import { csvResponse } from '@/server/reports/csv'
import { requireOrgContext } from '@/server/auth/context'
import * as ngo from '@/server/services/ngo.service'

export async function GET() {
  const ctx = await requireOrgContext('customer:read')
  const rows = await ngo.donorPledgeCsv(ctx)
  if (!rows) {
    return new Response('No pledges', { status: 404 })
  }
  return csvResponse('donor-pledges.csv', rows)
}

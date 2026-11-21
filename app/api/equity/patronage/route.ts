import { csvResponse } from '@/server/reports/csv'
import { requireOrgContext } from '@/server/auth/context'
import * as patronage from '@/server/services/patronage.service'

export async function GET() {
  const ctx = await requireOrgContext('account:read')
  const rows = await patronage.memberCsv(ctx)
  if (!rows) {
    return new Response('No patronage allocations', { status: 404 })
  }
  return csvResponse('patronage-members.csv', rows)
}

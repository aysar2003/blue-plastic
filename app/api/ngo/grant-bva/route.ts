import { grantBvaCsvRows } from '@/lib/erp/ngo-funds'
import { csvResponse } from '@/server/reports/csv'
import { requireOrgContext } from '@/server/auth/context'
import * as ngo from '@/server/services/ngo.service'

export async function GET() {
  const ctx = await requireOrgContext('report:read')
  const commitments = await ngo.grantFundCommitments(ctx)
  return csvResponse(
    'grant-bva-by-class.csv',
    grantBvaCsvRows(
      commitments.map((row) => ({
        fund: row.trackingCategoryName ?? 'Unclassified',
        budgeted: row.budgetAmount,
        actual: row.actual,
        encumbered: row.openPoTotal,
        remaining: row.remaining,
      })),
    ),
  )
}

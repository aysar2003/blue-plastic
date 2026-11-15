import { scholarshipSummaryCsvRows } from '@/lib/erp/scholarship-summary'
import { csvResponse } from '@/server/reports/csv'
import { requireOrgContext } from '@/server/auth/context'
import * as education from '@/server/services/education.service'

export async function GET() {
  const ctx = await requireOrgContext('invoice:read')
  const blocks = await education.scholarshipSummaryForTerms(ctx)
  const rows = [
    ['Term', 'Enrollments', 'Gross fees', 'Scholarship waived', 'Net'],
    ...scholarshipSummaryCsvRows(
      blocks.map((block) => ({
        termName: block.term.name,
        enrollmentCount: block.enrollmentCount,
        gross: block.gross,
        scholarshipWaived: block.scholarshipWaived,
        net: block.net,
      })),
    ),
  ]
  return csvResponse('scholarship-summary.csv', rows)
}
import { capaCsvRows } from '@/lib/erp/capa'
import { csvResponse } from '@/server/reports/csv'
import { requireOrgContext } from '@/server/auth/context'
import * as capaService from '@/server/services/capa.service'

export async function GET() {
  const ctx = await requireOrgContext('audit:read')
  const rows = await capaService.exportRows(ctx)
  return csvResponse('capa-quality.csv', [
    [
      'Number',
      'Title',
      'Status',
      'Bucket',
      'Owner',
      'Due',
      'Root cause',
      'Effectiveness',
      'Vendor',
      'Lot',
    ],
    ...capaCsvRows(rows),
  ])
}

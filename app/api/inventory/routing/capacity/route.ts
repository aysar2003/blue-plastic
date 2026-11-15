import { capacityReportCsvRows } from '@/lib/erp/routing-capacity'
import { csvResponse } from '@/server/reports/csv'
import { requireOrgContext } from '@/server/auth/context'
import * as routing from '@/server/services/routing.service'

export async function GET() {
  const ctx = await requireOrgContext('inventory:read')
  const report = await routing.capacityReport(ctx)
  const rows = [
  ['Work center', 'Store', 'Capacity min', 'Demand min', 'Load %', 'Open WO numbers'],
    ...capacityReportCsvRows(
      report.map((row) => ({
        centerName: row.name,
        storeName: row.storeName,
        capacityMinutes: row.capacityMinutes,
        demandMinutes: row.demandMinutes,
        loadPercent: row.loadPercent,
        workOrderNumbers: row.openWorkOrders.map((wo) => wo.number),
      })),
    ),
  ]
  return csvResponse('routing-capacity.csv', rows)
}
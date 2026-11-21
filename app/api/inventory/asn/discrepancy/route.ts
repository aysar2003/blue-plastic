import { asnDiscrepancyCsvRows } from '@/lib/erp/asn'
import { csvResponse } from '@/server/reports/csv'
import { requireOrgContext } from '@/server/auth/context'
import * as asn from '@/server/services/asn.service'

export async function GET() {
  const ctx = await requireOrgContext('inventory:read')
  const rows = await asn.discrepancyReport(ctx)
  return csvResponse('asn-po-discrepancy.csv', [
    ['ASN', 'PO', 'Vendor', 'Item', 'ASN qty', 'PO ordered', 'PO received', 'PO open', 'Variance', 'Kind'],
    ...rows.map((row) => [
      row.asnNumber,
      row.poNumber,
      row.vendorName,
      ...asnDiscrepancyCsvRows([row])[0]!,
    ]),
  ])
}

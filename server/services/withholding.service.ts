import 'server-only'

import { toCalendarDate } from '@/lib/date'
import { whtRemittanceCsv, type WhtRemittanceRow } from '@/lib/erp/withholding'
import { assertPermission, type OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

/**
 * Wave G: list posted bills that withheld tax, for remittance CSV (no e-filing).
 */
export async function listWithholdRemittance(
  ctx: OrgContext,
  options: { from?: string; to?: string } = {},
) {
  assertPermission(ctx, 'bill:read')
  const rows = await db.purchaseDocument.findMany({
    where: {
      orgId: ctx.orgId,
      type: 'BILL',
      deletedAt: null,
      status: { in: ['OPEN', 'PARTIAL', 'PAID'] },
      withholdAmount: { gt: 0 },
      ...(options.from || options.to
        ? {
            date: {
              ...(options.from ? { gte: new Date(`${options.from}T00:00:00.000Z`) } : {}),
              ...(options.to ? { lte: new Date(`${options.to}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
    },
    select: {
      number: true,
      date: true,
      subtotal: true,
      withholdPercent: true,
      withholdAmount: true,
      currencyCode: true,
      vendor: { select: { displayName: true } },
    },
    orderBy: { date: 'asc' },
    take: 2000,
  })

  const remittance: WhtRemittanceRow[] = rows.map((row) => ({
    billNumber: row.number,
    billDate: toCalendarDate(row.date),
    vendorName: row.vendor?.displayName ?? '—',
    baseAmount: row.subtotal.toFixed(4),
    withholdPercent: row.withholdPercent?.toFixed(4) ?? '0',
    withholdAmount: row.withholdAmount?.toFixed(4) ?? '0',
    currencyCode: row.currencyCode,
  }))

  return {
    rows: remittance,
    csv: whtRemittanceCsv(remittance),
    totalWithheld: remittance
      .reduce((sum, row) => sum + Number(row.withholdAmount), 0)
      .toFixed(2),
  }
}

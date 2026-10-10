import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { salesAppsForPermissions } from '@/components/layout/sales-apps'
import { today } from '@/lib/date'
import { formatMoney, ZERO } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as receivables from '@/server/services/receivables.service'

export const metadata: Metadata = { title: 'Sales' }

/**
 * Sales has its own front door. The lists and forms already exist; this page
 * decides which of them to open, and surfaces the three figures an owner checks
 * before picking a destination.
 */
export default async function SalesHubPage() {
  const ctx = await requireOrgContext('invoice:read')
  const apps = salesAppsForPermissions(ctx.permissions)
  const currency = ctx.organization.baseCurrency
  const now = today(ctx.organization.timeZone)

  const [arAging, openInvoices, openEstimates, openQuotations] = await Promise.all([
    receivables.aging(ctx, now),
    db.salesDocument.count({
      where: {
        orgId: ctx.orgId,
        type: 'INVOICE',
        status: { in: ['OPEN', 'PARTIAL'] },
        deletedAt: null,
      },
    }),
    db.salesDocument.count({
      where: {
        orgId: ctx.orgId,
        type: 'ESTIMATE',
        status: { notIn: ['VOID', 'DECLINED', 'CLOSED'] },
        deletedAt: null,
      },
    }),
    db.salesDocument.count({
      where: {
        orgId: ctx.orgId,
        type: 'QUOTATION',
        status: { notIn: ['VOID', 'DECLINED', 'CLOSED'] },
        deletedAt: null,
      },
    }),
  ])

  const overdue = receivables.OVERDUE_BUCKETS.reduce(
    (total, bucket) => total.plus(arAging.totals[bucket]),
    ZERO,
  )

  return (
    <AppLauncher
      eyebrow={ctx.organization.name}
      title="Sales"
      subtitle="Estimates, quotations, invoices, receipts, customers and the figures that follow them."
      apps={apps}
      insights={[
        {
          label: 'Owed to you',
          value: formatMoney(arAging.grandTotal, currency),
          hint: `${formatMoney(overdue, currency)} overdue`,
          href: '/reports/ar-aging',
        },
        {
          label: 'Open invoices',
          value: String(openInvoices),
          hint: openInvoices === 1 ? 'still unpaid' : 'still unpaid',
          href: '/sales/invoices?status=open',
        },
        {
          label: 'Open estimates',
          value: String(openEstimates),
          hint:
            openQuotations === 0
              ? openEstimates === 1
                ? 'waiting on a customer'
                : 'waiting on customers'
              : `${openQuotations} open quotation${openQuotations === 1 ? '' : 's'} too`,
          href: '/sales/estimates',
        },
      ]}
    />
  )
}

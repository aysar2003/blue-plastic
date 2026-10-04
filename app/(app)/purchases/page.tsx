import type { Metadata } from 'next'

import { AppLauncher } from '@/components/layout/app-launcher'
import { PURCHASE_HUB_APPS, visibleHubApps } from '@/components/layout/module-hubs'
import { today } from '@/lib/date'
import { formatMoney, ZERO } from '@/lib/money'
import { requireOrgContext } from '@/server/auth/context'
import { db } from '@/server/db'
import * as delivery from '@/server/services/delivery.service'
import * as payables from '@/server/services/payables.service'

export const metadata: Metadata = { title: 'Purchases' }

/**
 * Purchases has the same front door as Sales: coloured tiles, and the three
 * figures an owner checks before deciding where to go.
 */
export default async function PurchasesHubPage() {
  const ctx = await requireOrgContext('bill:read')
  const apps = visibleHubApps(PURCHASE_HUB_APPS, ctx.permissions)
  const currency = ctx.organization.baseCurrency
  const now = today(ctx.organization.timeZone)

  const [apAging, openBills, deliveryOverview] = await Promise.all([
    payables.aging(ctx, now),
    db.purchaseDocument.count({
      where: {
        orgId: ctx.orgId,
        type: 'BILL',
        status: { in: ['OPEN', 'PARTIAL'] },
        deletedAt: null,
      },
    }),
    delivery.overview(ctx),
  ])

  const overdue = payables.OVERDUE_BUCKETS.reduce(
    (total, bucket) => total.plus(apAging.totals[bucket]),
    ZERO,
  )

  return (
    <AppLauncher
      eyebrow={ctx.organization.name}
      title="Purchases"
      subtitle="Bills, expenses, vendors and the figures that follow them."

      apps={apps}
      insights={[
        {
          label: 'You owe',
          value: formatMoney(apAging.grandTotal, currency),
          hint: `${formatMoney(overdue, currency)} overdue`,
          href: '/reports/ap-aging',
        },
        {
          label: 'Open bills',
          value: String(openBills),
          hint: 'still unpaid',
          href: '/purchases/bills?status=open',
        },
        {
          label: 'Outstanding delivery',
          value: String(deliveryOverview.outstandingOrders),
          hint:
            deliveryOverview.outstandingOrders === 0
              ? 'all received'
              : `${formatMoney(deliveryOverview.outstandingValue, currency)} still due`,
          href: '/purchases/delivery',
        },
      ]}
    />
  )
}

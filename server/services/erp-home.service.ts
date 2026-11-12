import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'

import { toMoneyString } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

/** Extra home numbers for a full operating loop — CRM, AP, follow-ups. */
export function homeExtras(ctx: OrgContext) {
  return cachedHomeExtras(ctx.orgId)
}

const cachedHomeExtras = cache((orgId: string) =>
  unstable_cache(() => queryHomeExtras(orgId), ['home-extras-v3', orgId], { revalidate: 60 })(),
)

async function queryHomeExtras(orgId: string) {
  const [pipeline, followUps, unpaid] = await Promise.all([
    db.crmOpportunity.aggregate({
      where: { orgId, stage: { in: ['LEAD', 'QUALIFIED', 'PROPOSAL'] } },
      _sum: { amount: true },
      _count: true,
    }),
    db.crmActivity.count({
      where: { orgId, doneAt: null },
    }),
    db.$queryRaw<{ unpaid: string }[]>`
      SELECT COALESCE(SUM(d.total - COALESCE(a.applied, 0)), 0)::text AS unpaid
        FROM purchase_documents d
        LEFT JOIN (
          SELECT "billId", SUM(amount) AS applied
            FROM purchase_applications
           WHERE "orgId" = ${orgId}
           GROUP BY 1
        ) a ON a."billId" = d.id
       WHERE d."orgId" = ${orgId}
         AND d.type = 'BILL'
         AND d.status IN ('OPEN', 'PARTIAL')
         AND d."deletedAt" IS NULL
    `,
  ])

  return {
    pipelineCount: pipeline._count,
    pipelineAmount: toMoneyString(pipeline._sum.amount?.toString() ?? '0', 2),
    followUps,
    unpaidAp: toMoneyString(unpaid[0]?.unpaid ?? '0', 2),
  }
}

export function extrasOrZero() {
  return {
    pipelineCount: 0,
    pipelineAmount: '0.00',
    followUps: 0,
    unpaidAp: '0.00',
  }
}

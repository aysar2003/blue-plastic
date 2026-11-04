import 'server-only'

import { Decimal, ZERO } from '@/lib/money'
import type { OrgContext } from '@/server/auth/context'
import { db } from '@/server/db'

/** Extra home numbers for a full operating loop — CRM, AP, follow-ups. */
export async function homeExtras(ctx: OrgContext) {
  const [pipeline, followUps, unpaid] = await Promise.all([
    db.crmOpportunity.aggregate({
      where: { orgId: ctx.orgId, stage: { in: ['LEAD', 'QUALIFIED', 'PROPOSAL'] } },
      _sum: { amount: true },
      _count: true,
    }),
    db.crmActivity.count({
      where: { orgId: ctx.orgId, doneAt: null },
    }),
    db.$queryRaw<{ unpaid: string }[]>`
      SELECT COALESCE(SUM(d.total - COALESCE(a.applied, 0)), 0)::text AS unpaid
        FROM purchase_documents d
        LEFT JOIN (
          SELECT "billId", SUM(amount) AS applied
            FROM purchase_applications
           GROUP BY 1
        ) a ON a."billId" = d.id
       WHERE d."orgId" = ${ctx.orgId}
         AND d.type = 'BILL'
         AND d.status IN ('OPEN', 'PARTIAL')
         AND d."deletedAt" IS NULL
    `,
  ])

  return {
    pipelineCount: pipeline._count,
    pipelineAmount: new Decimal(pipeline._sum.amount?.toString() ?? 0),
    followUps,
    unpaidAp: new Decimal(unpaid[0]?.unpaid ?? 0),
  }
}

export function extrasOrZero() {
  return {
    pipelineCount: 0,
    pipelineAmount: ZERO,
    followUps: 0,
    unpaidAp: ZERO,
  }
}

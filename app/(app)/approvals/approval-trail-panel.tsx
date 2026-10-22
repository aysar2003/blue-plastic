import type { ApprovalEntityType } from '@prisma/client'

import { ApprovalTrail } from '@/components/approvals/approval-trail'
import { toApprovalTrailCycles } from '@/lib/approval-trail'
import { requireOrgContext } from '@/server/auth/context'
import * as approvalService from '@/server/services/approval.service'
import { trailFor } from '@/server/services/audit.service'

/** Bottom of a document form: every approval cycle for this paper. */
export async function ApprovalTrailPanel({
  entityType,
  entityId,
}: {
  entityType: ApprovalEntityType
  entityId: string
}) {
  const ctx = await requireOrgContext('org:read')
  const [rows, trail] = await Promise.all([
    approvalService.listForEntity(ctx, entityType, entityId),
    trailFor(ctx, entityId),
  ])
  if (rows.length === 0) return null
  return (
    <ApprovalTrail
      cycles={toApprovalTrailCycles(rows)}
      timeZone={ctx.organization.timeZone}
      createdBy={trail.entered?.name ?? null}
      createdAt={trail.entered?.at ?? null}
    />
  )
}

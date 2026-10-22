import type { OrgContext } from '@/server/auth/context'
import { decisionGate } from '@/server/services/approval.service'
import type { Trail } from '@/server/services/audit.service'

import type { ApprovalRow } from './request-table'

type RequestShape = {
  id: string
  title: string
  href: string
  entityId: string
  entityType: ApprovalRow['entityType']
  amount: { toString(): string } | null
  currencyCode: string | null
  submittedAt: Date
  decidedAt: Date | null
  submittedBy: { name: string }
  submittedById: string
  currentLevel: number
  requiredLevels: number
  status: ApprovalRow['status']
  policy: {
    requireDifferentApprover: boolean
    approvers: { userId: string; user: { name: string } }[]
  } | null
}

export function toApprovalRow(ctx: OrgContext, row: RequestShape): ApprovalRow {
  const approve = decisionGate(ctx, row, 'APPROVED')
  const reject = decisionGate(ctx, row, 'REJECTED')
  return {
    id: row.id,
    title: row.title,
    href: row.href,
    entityId: row.entityId,
    entityType: row.entityType,
    amount: row.amount,
    currencyCode: row.currencyCode,
    submittedAt: row.submittedAt,
    decidedAt: row.decidedAt,
    submittedBy: row.submittedBy,
    submittedById: row.submittedById,
    createdBy: null,
    currentLevel: row.currentLevel,
    requiredLevels: row.requiredLevels,
    status: row.status,
    canDecide: approve.ok,
    canReject: reject.ok,
    decideReason: approve.reason ?? reject.reason,
    assignedTo: row.policy?.approvers.map((person) => person.user.name) ?? [],
  }
}

export function withCreatedBy(rows: ApprovalRow[], trails: Map<string, Trail>) {
  return rows.map((row) => ({
    ...row,
    createdBy: trails.get(row.entityId)?.entered?.name ?? null,
  }))
}

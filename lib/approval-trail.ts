/**
 * Shape the approval inbox rows into a story for the document form:
 * who submitted, who already signed, and who the paper is waiting for.
 */

export type ApprovalTrailDecision = {
  level: number
  decision: 'APPROVED' | 'REJECTED'
  by: string
  at: Date
  note: string | null
}

export type ApprovalTrailCycle = {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  submittedBy: string
  submittedAt: Date
  currentLevel: number
  requiredLevels: number
  /** Named people this workflow is assigned to who have not yet signed. */
  waitingFor: string[]
  /** True when the rule has no named approvers — anyone with Approve may decide. */
  waitingAnyone: boolean
  decisions: ApprovalTrailDecision[]
  decidedAt: Date | null
}

export type ApprovalTrailRequest = {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  submittedAt: Date
  decidedAt: Date | null
  currentLevel: number
  requiredLevels: number
  submittedBy: { name: string }
  policy: {
    approvers: { userId: string; user: { name: string } }[]
  } | null
  decisions: {
    level: number
    decision: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
    note: string | null
    decidedAt: Date
    decidedBy: { name: string }
  }[]
}

export function toApprovalTrailCycles(rows: ApprovalTrailRequest[]): ApprovalTrailCycle[] {
  return rows.map((row) => {
    const signed = new Set(
      row.decisions
        .filter((step) => step.decision === 'APPROVED' || step.decision === 'REJECTED')
        .map((step) => step.decidedBy.name),
    )
    const assigned = row.policy?.approvers.map((person) => person.user.name) ?? []
    const waitingFor =
      row.status === 'PENDING' ? assigned.filter((name) => !signed.has(name)) : []

    return {
      id: row.id,
      status: row.status,
      submittedBy: row.submittedBy.name,
      submittedAt: row.submittedAt,
      currentLevel: row.currentLevel,
      requiredLevels: row.requiredLevels,
      waitingFor,
      waitingAnyone: row.status === 'PENDING' && assigned.length === 0,
      decidedAt: row.decidedAt,
      decisions: row.decisions
        .filter(
          (step): step is typeof step & { decision: 'APPROVED' | 'REJECTED' } =>
            step.decision === 'APPROVED' || step.decision === 'REJECTED',
        )
        .map((step) => ({
          level: step.level,
          decision: step.decision,
          by: step.decidedBy.name,
          at: step.decidedAt,
          note: step.note,
        })),
    }
  })
}

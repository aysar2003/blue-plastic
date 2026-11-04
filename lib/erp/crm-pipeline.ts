export const CRM_STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const
export type CrmStage = (typeof CRM_STAGES)[number]

const FORWARD: Record<CrmStage, ReadonlySet<CrmStage>> = {
  LEAD: new Set(['QUALIFIED', 'LOST']),
  QUALIFIED: new Set(['PROPOSAL', 'LOST']),
  PROPOSAL: new Set(['WON', 'LOST']),
  WON: new Set(),
  LOST: new Set(['LEAD']),
}

export function canMoveOpportunity(from: CrmStage, to: CrmStage): boolean {
  if (from === to) return false
  return FORWARD[from]?.has(to) === true
}

export function isOpenOpportunity(stage: CrmStage): boolean {
  return stage === 'LEAD' || stage === 'QUALIFIED' || stage === 'PROPOSAL'
}

export const CRM_ACTIVITY_KINDS = ['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE'] as const
export type CrmActivityKind = (typeof CRM_ACTIVITY_KINDS)[number]

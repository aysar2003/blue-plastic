/**
 * Applicant pipeline for a complete ATS-lite that still has real stage rules.
 * Hire is only legal from OFFER. Reject is legal from any open stage.
 */

export const APPLICANT_STAGES = [
  'NEW',
  'SCREENING',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
] as const

export type ApplicantStage = (typeof APPLICANT_STAGES)[number]

const OPEN: ReadonlySet<ApplicantStage> = new Set(['NEW', 'SCREENING', 'INTERVIEW', 'OFFER'])
const TERMINAL: ReadonlySet<ApplicantStage> = new Set(['HIRED', 'REJECTED'])

const FORWARD: Record<ApplicantStage, ReadonlySet<ApplicantStage>> = {
  NEW: new Set(['SCREENING', 'INTERVIEW', 'REJECTED']),
  SCREENING: new Set(['INTERVIEW', 'REJECTED']),
  INTERVIEW: new Set(['OFFER', 'REJECTED']),
  OFFER: new Set(['HIRED', 'REJECTED']),
  HIRED: new Set(),
  REJECTED: new Set(['NEW']),
}

export function isOpenApplicantStage(stage: ApplicantStage): boolean {
  return OPEN.has(stage)
}

export function canMoveApplicant(from: ApplicantStage, to: ApplicantStage): boolean {
  if (from === to) return false
  return FORWARD[from]?.has(to) === true
}

export function canHireApplicant(stage: ApplicantStage): boolean {
  return stage === 'OFFER'
}

export function canRejectApplicant(stage: ApplicantStage): boolean {
  return OPEN.has(stage)
}

export function isTerminalApplicantStage(stage: ApplicantStage): boolean {
  return TERMINAL.has(stage)
}

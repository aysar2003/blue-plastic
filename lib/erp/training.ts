/**
 * Employee training courses and completions. HR record, not a campus LMS / SIS.
 */

export const TRAINING_STATUSES = ['ENROLLED', 'COMPLETED', 'FAILED'] as const
export type TrainingStatus = (typeof TRAINING_STATUSES)[number]

export const TRAINING_LEGAL =
  'Staff training records for this company. Not a student information system, not SCORM, not a campus LMS.'

export function isTrainingStatus(value: string): value is TrainingStatus {
  return (TRAINING_STATUSES as readonly string[]).includes(value)
}

export function canCompleteTraining(status: TrainingStatus): boolean {
  return status === 'ENROLLED'
}

export function canFailTraining(status: TrainingStatus): boolean {
  return status === 'ENROLLED'
}

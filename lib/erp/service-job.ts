export const SERVICE_JOB_STATUSES = ['DRAFT', 'SCHEDULED', 'DONE', 'CANCELLED'] as const
export type ServiceJobStatus = (typeof SERVICE_JOB_STATUSES)[number]

export const SERVICE_JOB_LINE_KINDS = ['PART', 'LABOR', 'TRAVEL'] as const
export type ServiceJobLineKind = (typeof SERVICE_JOB_LINE_KINDS)[number]

export function isServiceJobStatus(value: string): value is ServiceJobStatus {
  return (SERVICE_JOB_STATUSES as readonly string[]).includes(value)
}

export function canScheduleServiceJob(status: ServiceJobStatus): boolean {
  return status === 'DRAFT'
}

export function canCompleteServiceJob(status: ServiceJobStatus): boolean {
  return status === 'SCHEDULED'
}

export function canCancelServiceJob(status: ServiceJobStatus): boolean {
  return status === 'DRAFT' || status === 'SCHEDULED'
}
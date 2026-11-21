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
  return status === 'DRAFT' || status === 'SCHEDULED' || status === 'DONE'
}

/** Cancel of a completed job voids the invoice so van stock issued on complete is restored. */
export function cancelRestoresVanStock(status: ServiceJobStatus, salesDocumentId: string | null | undefined): boolean {
  return status === 'DONE' && Boolean(salesDocumentId)
}

export function promisedWindowLabel(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string | null {
  if (!start && !end) return null
  const fmt = (value: Date | string) => {
    const d = typeof value === 'string' ? new Date(value) : value
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 16).replace('T', ' ')
  }
  const from = start ? fmt(start) : null
  const to = end ? fmt(end) : null
  if (from && to) return `${from} – ${to}`
  return from ?? to
}
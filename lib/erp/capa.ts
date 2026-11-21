export const CAPA_STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED'] as const
export type CapaStatus = (typeof CAPA_STATUSES)[number]

export function isCapaStatus(value: string): value is CapaStatus {
  return (CAPA_STATUSES as readonly string[]).includes(value)
}

export function canCloseCapa(status: CapaStatus): boolean {
  return status === 'OPEN' || status === 'IN_PROGRESS'
}

export function canReopenCapa(status: CapaStatus): boolean {
  return status === 'CLOSED'
}

export function nextCapaStatus(current: CapaStatus, target: CapaStatus): { ok: true } | { ok: false; message: string } {
  if (current === target) return { ok: true }
  if (target === 'IN_PROGRESS' && current === 'OPEN') return { ok: true }
  if (target === 'CLOSED' && (current === 'OPEN' || current === 'IN_PROGRESS')) return { ok: true }
  if (target === 'OPEN' && current === 'CLOSED') return { ok: true }
  return { ok: false, message: `Cannot move CAPA from ${current} to ${target}.` }
}

export function isCapaOverdue(input: {
  status: CapaStatus
  dueDate: string | Date | null | undefined
  asOf: string
}): boolean {
  if (input.status === 'CLOSED') return false
  if (!input.dueDate) return false
  const due =
    typeof input.dueDate === 'string' ? input.dueDate.slice(0, 10) : input.dueDate.toISOString().slice(0, 10)
  return due < input.asOf
}

export function capaExportBucket(input: {
  status: CapaStatus
  dueDate: string | Date | null | undefined
  asOf: string
}): 'open' | 'overdue' | 'closed' {
  if (input.status === 'CLOSED') return 'closed'
  if (isCapaOverdue(input)) return 'overdue'
  return 'open'
}

export type CapaCsvRow = {
  number: string
  title: string
  status: string
  bucket: string
  ownerName: string | null
  dueDate: string | null
  rootCause: string | null
  effectivenessDate: string | null
  vendorName: string | null
  lotNumber: string | null
}

export function capaCsvRows(rows: CapaCsvRow[]) {
  return rows.map((row) => [
    row.number,
    row.title,
    row.status,
    row.bucket,
    row.ownerName ?? '',
    row.dueDate ?? '',
    row.rootCause ?? '',
    row.effectivenessDate ?? '',
    row.vendorName ?? '',
    row.lotNumber ?? '',
  ])
}
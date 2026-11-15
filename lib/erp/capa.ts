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
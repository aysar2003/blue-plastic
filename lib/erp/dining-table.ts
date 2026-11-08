export const DINING_TABLE_STATUSES = ['OPEN', 'SEATED', 'BILL'] as const
export type DiningTableStatus = (typeof DINING_TABLE_STATUSES)[number]

const TRANSITIONS: Record<DiningTableStatus, readonly DiningTableStatus[]> = {
  OPEN: ['SEATED'],
  SEATED: ['BILL', 'OPEN'],
  BILL: ['OPEN', 'SEATED'],
}

export function canTransitionDiningTable(
  from: DiningTableStatus,
  to: DiningTableStatus,
): boolean {
  if (from === to) return true
  return TRANSITIONS[from].includes(to)
}

export function nextDiningTableStatus(
  from: DiningTableStatus,
  to: DiningTableStatus,
): DiningTableStatus {
  if (!canTransitionDiningTable(from, to)) {
    throw new Error(`Cannot move dining table from ${from} to ${to}`)
  }
  return to
}

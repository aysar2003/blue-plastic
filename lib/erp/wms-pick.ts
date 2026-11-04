/**
 * Human pick / putaway against a bin. Not robotics, not AS/RS, not a PLC.
 */

export const PICK_STATUSES = ['OPEN', 'PICKING', 'PICKED', 'CANCELLED'] as const
export type PickStatus = (typeof PICK_STATUSES)[number]

export const WMS_LEGAL =
  'Warehouse bins and pick tasks for people in this company. Robots and automated storage are out of scope.'

export function isPickStatus(value: string): value is PickStatus {
  return (PICK_STATUSES as readonly string[]).includes(value)
}

export function canStartPick(status: PickStatus): boolean {
  return status === 'OPEN'
}

export function canCompletePick(status: PickStatus): boolean {
  return status === 'OPEN' || status === 'PICKING'
}

export function canCancelPick(status: PickStatus): boolean {
  return status === 'OPEN' || status === 'PICKING'
}

export function binCodeValid(code: string): boolean {
  return /^[A-Z0-9][A-Z0-9.\-]{0,15}$/i.test(code.trim())
}

/** Two diary slots clash when they overlap and both are still booked. */

export function slotsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

export const BOOKED_APPOINTMENT = 'BOOKED' as const

export function canCompleteAppointment(status: string): boolean {
  return status === 'BOOKED'
}

export function canCancelAppointment(status: string): boolean {
  return status === 'BOOKED'
}

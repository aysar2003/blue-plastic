export const ROOM_STATUSES = ['VACANT', 'OCCUPIED', 'DIRTY', 'CLEAN', 'OOO'] as const
export type RoomStatus = (typeof ROOM_STATUSES)[number]

export const STAY_STATUSES = ['RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'] as const
export type StayStatus = (typeof STAY_STATUSES)[number]

/** Occupancy % for a snapshot of rooms (exclude OOO from denominator). */
export function occupancyPercent(rooms: { status: RoomStatus }[]): number {
  const sellable = rooms.filter((room) => room.status !== 'OOO')
  if (sellable.length === 0) return 0
  const occupied = sellable.filter((room) => room.status === 'OCCUPIED').length
  return Math.round((occupied / sellable.length) * 1000) / 10
}

export function roomStatusAfterCheckIn(): RoomStatus {
  return 'OCCUPIED'
}

export function roomStatusAfterCheckOut(): RoomStatus {
  return 'DIRTY'
}

export function canCheckInStay(status: StayStatus): boolean {
  return status === 'RESERVED'
}

export function canCheckOutStay(status: StayStatus): boolean {
  return status === 'CHECKED_IN'
}

export function folioLineAmount(quantity: string | number, unitPrice: string | number): string {
  const qty = Number(quantity)
  const price = Number(unitPrice)
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return '0.0000'
  return (qty * price).toFixed(4)
}

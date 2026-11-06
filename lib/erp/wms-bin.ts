/**
 * Phase 31: bin quantity, putaway, waves. Not robotics / AS/RS / PLC.
 */

import { Decimal, ZERO } from '@/lib/money'

export const PUTAWAY_STATUSES = ['OPEN', 'DONE', 'CANCELLED'] as const
export type PutawayStatus = (typeof PUTAWAY_STATUSES)[number]

export const WAVE_STATUSES = ['OPEN', 'RELEASED', 'DONE', 'CANCELLED'] as const
export type WaveStatus = (typeof WAVE_STATUSES)[number]

export function canCompletePutaway(status: PutawayStatus): boolean {
  return status === 'OPEN'
}

export function canCancelPutaway(status: PutawayStatus): boolean {
  return status === 'OPEN'
}

export function canReleaseWave(status: WaveStatus): boolean {
  return status === 'OPEN'
}

export function canCancelWave(status: WaveStatus): boolean {
  return status === 'OPEN' || status === 'RELEASED'
}

export function nextBinRunning(prior: Decimal.Value, delta: Decimal.Value): Decimal {
  return new Decimal(prior).plus(delta)
}

export function refuseShortBin(onHand: Decimal.Value, needed: Decimal.Value): boolean {
  return new Decimal(needed).greaterThan(onHand)
}

export function waveNumberFromSeq(seq: number): string {
  return `WV-${String(seq).padStart(5, '0')}`
}

export { ZERO }

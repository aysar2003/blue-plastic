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

export type WaveLabelCsvInput = {
  waveNumber: string
  orderNumber: string
  customerName: string
  shipTo: string | null
  carrier: string | null
  itemName: string
  sku: string | null
  qty: string
}

/** Flat label rows for wave pick CSV download. */
export function waveLabelCsvRows(lines: WaveLabelCsvInput[]) {
  return lines.map((row) => [
    row.waveNumber,
    row.orderNumber,
    row.customerName,
    row.shipTo ?? '',
    row.carrier ?? '',
    row.itemName,
    row.sku ?? '',
    row.qty,
  ])
}

export { ZERO }

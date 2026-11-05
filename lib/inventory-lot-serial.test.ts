import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import {
  assertLotSerialForMovement,
  onHandByLot,
  onHandForSerial,
} from '@/lib/inventory-lot-serial'

describe('assertLotSerialForMovement', () => {
  const plain = { name: 'Pipe', trackLots: false, trackSerials: false }
  const lot = { name: 'Pipe', trackLots: true, trackSerials: false }
  const serial = { name: 'Meter', trackLots: false, trackSerials: true }

  it('allows plain items without lot or serial', () => {
    expect(assertLotSerialForMovement(plain, new Decimal(2), null, null)).toBeNull()
  })

  it('rejects lot/serial on untracked items', () => {
    expect(assertLotSerialForMovement(plain, new Decimal(1), 'A1', null)).toMatch(/not set to track/)
  })

  it('requires a lot on receive and issue when trackLots', () => {
    expect(assertLotSerialForMovement(lot, new Decimal(5), null, null)).toMatch(/requires a lot/)
    expect(assertLotSerialForMovement(lot, new Decimal(-2), 'L-1', null)).toBeNull()
  })

  it('requires serial qty 1 when trackSerials', () => {
    expect(assertLotSerialForMovement(serial, new Decimal(2), null, 'S-1')).toMatch(/quantity 1/)
    expect(assertLotSerialForMovement(serial, new Decimal(1), null, 'S-1')).toBeNull()
    expect(assertLotSerialForMovement(serial, new Decimal(-1), null, null)).toMatch(/requires a serial/)
  })
})

describe('onHandByLot / onHandForSerial', () => {
  it('nets quantities per lot', () => {
    const map = onHandByLot([
      { lotNumber: 'A', quantity: '10' },
      { lotNumber: 'A', quantity: '-3' },
      { lotNumber: 'B', quantity: '2' },
      { lotNumber: null, quantity: '1' },
    ])
    expect(map.get('A')?.toFixed(0)).toBe('7')
    expect(map.get('B')?.toFixed(0)).toBe('2')
    expect(map.get('')?.toFixed(0)).toBe('1')
  })

  it('nets a serial to on-hand', () => {
    expect(
      onHandForSerial(
        [
          { serialNumber: 'S1', quantity: '1' },
          { serialNumber: 'S1', quantity: '-1' },
          { serialNumber: 'S2', quantity: '1' },
        ],
        'S1',
      ).toFixed(0),
    ).toBe('0')
    expect(
      onHandForSerial([{ serialNumber: 'S2', quantity: '1' }], 'S2').toFixed(0),
    ).toBe('1')
  })
})

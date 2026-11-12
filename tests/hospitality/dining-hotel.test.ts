import { describe, expect, it } from 'vitest'

import { canTransitionDiningTable, nextDiningTableStatus } from '@/lib/erp/dining-table'
import {
  canCheckInStay,
  canCheckOutStay,
  folioLineAmount,
  occupancyPercent,
  roomStatusAfterCheckIn,
  roomStatusAfterCheckOut,
} from '@/lib/erp/hotel'
import { splitPosTender } from '@/lib/erp/pos-tip'
import { getPack } from '@/lib/packs'
import { buildPosTipJournal } from '@/server/accounting/builders/pos'
import { Decimal } from '@/lib/money'

describe('dining table status', () => {
  it('allows open → seated → bill → open', () => {
    expect(canTransitionDiningTable('OPEN', 'SEATED')).toBe(true)
    expect(canTransitionDiningTable('SEATED', 'BILL')).toBe(true)
    expect(canTransitionDiningTable('BILL', 'OPEN')).toBe(true)
    expect(canTransitionDiningTable('OPEN', 'BILL')).toBe(false)
    expect(nextDiningTableStatus('SEATED', 'OPEN')).toBe('OPEN')
  })
})

describe('hotel helpers', () => {
  it('computes occupancy excluding OOO', () => {
    expect(
      occupancyPercent([
        { status: 'OCCUPIED' },
        { status: 'VACANT' },
        { status: 'OOO' },
        { status: 'OCCUPIED' },
      ]),
    ).toBe(66.7)
  })

  it('gates stay lifecycle and room status', () => {
    expect(canCheckInStay('RESERVED')).toBe(true)
    expect(canCheckOutStay('CHECKED_IN')).toBe(true)
    expect(canCheckOutStay('RESERVED')).toBe(false)
    expect(roomStatusAfterCheckIn()).toBe('OCCUPIED')
    expect(roomStatusAfterCheckOut()).toBe('DIRTY')
  })

  it('multiplies folio lines', () => {
    expect(folioLineAmount('2', '50')).toBe('100.0000')
  })
})

describe('POS tip tender split', () => {
  it('requires tender to cover sale plus tip', () => {
    const bad = splitPosTender({ saleDue: '10', tipAmount: '2', tenderTotal: '11' })
    expect(bad.ok).toBe(false)
    const good = splitPosTender({ saleDue: '10', tipAmount: '2', tenderTotal: '12.5' })
    expect(good.ok).toBe(true)
    if (good.ok) {
      expect(good.change.toFixed(2)).toBe('0.50')
      expect(good.tip.toFixed(2)).toBe('2.00')
    }
  })
})

describe('POS tip journal', () => {
  it('balances tip liability and skips zero', () => {
    expect(
      buildPosTipJournal({
        date: '2026-11-07',
        orderId: 'ord1',
        tenderAccountId: 'cash',
        tipLiabilityAccountId: 'tips',
        amount: 0,
        registerName: 'Front',
      }),
    ).toBeNull()

    const draft = buildPosTipJournal({
      date: '2026-11-07',
      orderId: 'ord1',
      tenderAccountId: 'cash',
      tipLiabilityAccountId: 'tips',
      amount: '3.50',
      registerName: 'Front',
    })
    expect(draft?.sourceType).toBe('POS_TIP')
    const debit = draft!.lines.reduce((s, l) => s.plus(l.debit ?? 0), new Decimal(0))
    const credit = draft!.lines.reduce((s, l) => s.plus(l.credit ?? 0), new Decimal(0))
    expect(debit.eq(credit)).toBe(true)
    expect(debit.toFixed(2)).toBe('3.50')
  })
})

describe('hospitality packs', () => {
  it('exposes night audit and occupancy checklist links', () => {
    expect(getPack('restaurant')?.setupChecklist.some((row) => row.id === 'audit')).toBe(true)
    expect(getPack('hotel')?.setupChecklist.some((row) => row.id === 'stays')).toBe(true)
    expect(getPack('retail')?.setupChecklist.some((row) => row.id === 'reports')).toBe(true)
  })
})

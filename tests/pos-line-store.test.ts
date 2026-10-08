import { describe, expect, it } from 'vitest'

import { chooseLineStore, needsPickTicket } from '@/lib/pos-line-store'

const OFFICE = 'office'
const MAIN = 'main-store'
const HOSP = 'hospital-store'
const stores = [OFFICE, MAIN, HOSP]

const base = {
  counterStoreId: OFFICE,
  tracked: true,
  quantity: 2,
  activeStoreIds: stores,
}

describe('chooseLineStore', () => {
  it('sells from the counter store when it has enough', () => {
    expect(chooseLineStore({ ...base, onHandByStore: { [OFFICE]: '5', [MAIN]: '50' } })).toBe(OFFICE)
  })

  it("takes the line from another store when the counter's store can't cover it", () => {
    expect(chooseLineStore({ ...base, onHandByStore: { [OFFICE]: '1', [MAIN]: '3', [HOSP]: '9' } })).toBe(HOSP)
    expect(chooseLineStore({ ...base, onHandByStore: { [MAIN]: '2' } })).toBe(MAIN)
  })

  it('stays on the counter store when no store can cover it (negative-stock warning applies)', () => {
    expect(chooseLineStore({ ...base, quantity: 10, onHandByStore: { [OFFICE]: '1', [MAIN]: '3' } })).toBe(OFFICE)
  })

  it("honours the cashier's pick, but only for an active store", () => {
    expect(chooseLineStore({ ...base, requested: MAIN, onHandByStore: { [OFFICE]: '9' } })).toBe(MAIN)
    expect(chooseLineStore({ ...base, requested: 'archived', onHandByStore: { [OFFICE]: '9' } })).toBe(OFFICE)
  })

  it('services and non-stock lines just take the counter store', () => {
    expect(chooseLineStore({ ...base, tracked: false, onHandByStore: {} })).toBe(OFFICE)
  })

  it('a register with its own store sells from it first', () => {
    expect(
      chooseLineStore({ ...base, counterStoreId: MAIN, onHandByStore: { [MAIN]: '2', [OFFICE]: '9' } }),
    ).toBe(MAIN)
  })
})

describe('needsPickTicket', () => {
  it('POS: no ticket for goods from the counter store; ticket for any other store', () => {
    expect(needsPickTicket(OFFICE, OFFICE)).toBe(false)
    expect(needsPickTicket(MAIN, OFFICE)).toBe(true)
  })

  it('normal sales (no counter): every stocked line gets a ticket, as before', () => {
    expect(needsPickTicket(MAIN, undefined)).toBe(true)
    expect(needsPickTicket(null, undefined)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import {
  activePosOrder,
  addPosOrder,
  clearPosOrder,
  closePosOrder,
  createPosOrderBook,
  loadPosOrderBook,
  patchPosOrder,
  POS_OPEN_ORDER_LIMIT,
  posOrderIsEmpty,
  posOrderStorageKey,
  savePosOrderBook,
  selectPosOrder,
  settlePosOrder,
  type PosOrderBook,
  type PosOrderStorage,
} from '@/lib/pos-open-orders'

function ids() {
  let n = 0
  return () => `id-${++n}`
}

function line(itemId: string, quantity = 1) {
  return { itemId, name: itemId, price: '10', quantity, storeId: null }
}

function memory(): PosOrderStorage {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

describe('POS open orders', () => {
  it('starts on a Register ticket', () => {
    const book = createPosOrderBook(ids())
    expect(book.orders.map((order) => order.label)).toEqual(['Register'])
    expect(activePosOrder(book).kind).toBe('register')
    expect(posOrderIsEmpty(activePosOrder(book))).toBe(true)
  })

  it('opens a new numbered ticket without touching the one already on screen', () => {
    const make = ids()
    let book = createPosOrderBook(make)
    book = patchPosOrder(book, 'id-1', {
      cart: [line('A4', 2)],
      customerId: 'cust-1',
      note: 'hold',
    })
    book = addPosOrder(book, make)

    expect(book.orders.map((order) => order.label)).toEqual(['Register', '0001'])
    expect(activePosOrder(book).label).toBe('0001')
    expect(activePosOrder(book).cart).toEqual([])
    expect(activePosOrder(book).customerId).toBeNull()
    expect(activePosOrder(book).note).toBe('')

    const register = book.orders[0]!
    expect(register.cart).toEqual([line('A4', 2)])
    expect(register.customerId).toBe('cust-1')
    expect(register.note).toBe('hold')
  })

  it('keeps each ticket’s cart, customer, and note when switching', () => {
    const make = ids()
    let book = addPosOrder(createPosOrderBook(make), make)
    book = patchPosOrder(book, 'id-2', { cart: [line('BBB')], customerId: 'cust-2', note: 'blue' })
    book = selectPosOrder(book, 'id-1')
    book = patchPosOrder(book, 'id-1', { cart: [line('REG')], note: 'front' })
    book = selectPosOrder(book, 'id-2')

    const shown = activePosOrder(book)
    expect(shown.label).toBe('0001')
    expect(shown.cart.map((row) => row.itemId)).toEqual(['BBB'])
    expect(shown.customerId).toBe('cust-2')
    expect(shown.note).toBe('blue')

    book = selectPosOrder(book, 'id-1')
    expect(activePosOrder(book).cart.map((row) => row.itemId)).toEqual(['REG'])
    expect(activePosOrder(book).note).toBe('front')
  })

  it('closes an empty extra ticket and leaves a ticket that still has lines', () => {
    const make = ids()
    let book = addPosOrder(addPosOrder(createPosOrderBook(make), make), make)
    book = patchPosOrder(book, 'id-2', { cart: [line('kept')] })
    book = selectPosOrder(book, 'id-3')

    book = closePosOrder(book, 'id-3')
    expect(book.orders.map((order) => order.id)).toEqual(['id-1', 'id-2'])
    expect(book.activeId).toBe('id-1')

    const withLines = closePosOrder(book, 'id-2')
    expect(withLines).toBe(book)
  })

  it('does not remove the Register ticket when it is empty', () => {
    const book = createPosOrderBook(ids())
    expect(closePosOrder(book, 'id-1')).toBe(book)
  })

  it('removes a paid extra ticket and clears a paid Register ticket', () => {
    const make = ids()
    let book = addPosOrder(createPosOrderBook(make), make)
    book = patchPosOrder(book, 'id-1', { cart: [line('reg')], customerId: 'c', note: 'n' })
    book = patchPosOrder(book, 'id-2', { cart: [line('extra')] })

    book = settlePosOrder(book, 'id-2')
    expect(book.orders.map((order) => order.label)).toEqual(['Register'])
    expect(book.activeId).toBe('id-1')
    expect(activePosOrder(book).cart.map((row) => row.itemId)).toEqual(['reg'])

    book = settlePosOrder(book, 'id-1')
    expect(book.orders).toHaveLength(1)
    expect(book.orders[0]).toMatchObject({ kind: 'register', label: 'Register', cart: [], customerId: null, note: '' })
  })

  it('cancel discards an extra ticket and only empties Register', () => {
    const make = ids()
    let book = addPosOrder(createPosOrderBook(make), make)
    book = patchPosOrder(book, 'id-2', { cart: [line('gone')], customerId: 'c', note: 'n' })
    book = clearPosOrder(book, 'id-2')
    expect(book.orders.map((order) => order.id)).toEqual(['id-1'])
    expect(book.activeId).toBe('id-1')

    book = patchPosOrder(book, 'id-1', { cart: [line('x')], note: 'bye' })
    book = clearPosOrder(book, 'id-1')
    expect(activePosOrder(book)).toMatchObject({ kind: 'register', cart: [], note: '' })
  })

  it('stops opening tickets past the limit', () => {
    const make = ids()
    let book = createPosOrderBook(make)
    for (let i = 0; i < POS_OPEN_ORDER_LIMIT + 3; i++) book = addPosOrder(book, make)
    expect(book.orders).toHaveLength(POS_OPEN_ORDER_LIMIT)
  })

  it('restores the same cashier’s open tickets after a refresh, and not another user’s', () => {
    const make = ids()
    let book = addPosOrder(createPosOrderBook(make), make)
    book = patchPosOrder(book, 'id-1', { cart: [line('A4', 3)], customerId: 'cust-1', note: 'wait' })
    book = selectPosOrder(book, 'id-2')
    book = patchPosOrder(book, 'id-2', { cart: [line('BBB')] })

    const store = memory()
    savePosOrderBook(store, 'user-a', 'sess-1', book)

    const restored = loadPosOrderBook(store, 'user-a', 'sess-1', ids())
    expect(restored.activeId).toBe('id-2')
    expect(restored.orders[0]).toMatchObject({ cart: [line('A4', 3)], customerId: 'cust-1', note: 'wait' })
    expect(restored.orders[1]).toMatchObject({ label: '0001', cart: [line('BBB')] })

    const otherUser = loadPosOrderBook(store, 'user-b', 'sess-1', () => 'fresh')
    expect(otherUser.orders.map((order) => order.id)).toEqual(['fresh'])

    const otherSession = loadPosOrderBook(store, 'user-a', 'sess-2', () => 'fresh-2')
    expect(otherSession.orders.map((order) => order.id)).toEqual(['fresh-2'])

    expect(posOrderStorageKey('user-a', 'sess-1')).not.toBe(posOrderStorageKey('user-b', 'sess-1'))
  })

  it('ignores a stored book that was rewritten for a different cashier', () => {
    const store = memory()
    const book = createPosOrderBook(() => 'id-1')
    savePosOrderBook(store, 'user-a', 'sess-1', book)
    const key = posOrderStorageKey('user-a', 'sess-1')
    const raw = JSON.parse(store.getItem(key)!) as { userId: string; book: PosOrderBook }
    raw.userId = 'user-b'
    store.setItem(key, JSON.stringify(raw))

    const loaded = loadPosOrderBook(store, 'user-a', 'sess-1', () => 'clean')
    expect(loaded.orders.map((order) => order.id)).toEqual(['clean'])
  })

  it('starts clean when stored tickets are unreadable', () => {
    const store = memory()
    store.setItem(posOrderStorageKey('user-a', 'sess-1'), '{not json')
    expect(loadPosOrderBook(store, 'user-a', 'sess-1', () => 'clean').orders[0]?.id).toBe('clean')
  })
})

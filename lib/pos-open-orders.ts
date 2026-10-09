/**
 * Open tickets on one till.
 *
 * Odoo-style: the cashier parks one customer's cart and starts another without
 * posting. Tickets stay in this browser, scoped to the signed-in user and the
 * open session, until Payment. Payment still runs the existing checkout, which
 * posts the sale on that session under the signed-in user.
 */

export type PosOpenCartLine = {
  itemId: string
  name: string
  price: string
  quantity: number
  storeId: string | null
}

export type PosOpenOrder = {
  id: string
  /** Home ticket on the till, or an extra customer started with "+". */
  kind: 'register' | 'order'
  /** "Register", or an order number such as "0001". */
  label: string
  cart: PosOpenCartLine[]
  customerId: string | null
  note: string
}

export type PosOrderBook = {
  orders: PosOpenOrder[]
  activeId: string
  nextNumber: number
}

export type PosOrderIdFactory = () => string

export type PosOrderStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const POS_OPEN_ORDER_LIMIT = 12
const REGISTER_LABEL = 'Register'
const STORAGE_VERSION = 1

export function posOrderStorageKey(userId: string, sessionId: string) {
  return `pos-open-orders:v1:${userId}:${sessionId}`
}

export function createPosOrderBook(ids: PosOrderIdFactory = newOrderId): PosOrderBook {
  const register = blankOrder(ids(), 'register', REGISTER_LABEL)
  return { orders: [register], activeId: register.id, nextNumber: 1 }
}

export function activePosOrder(book: PosOrderBook): PosOpenOrder {
  return book.orders.find((order) => order.id === book.activeId) ?? book.orders[0]!
}

/** Park the current customer and open a new empty ticket. */
export function addPosOrder(book: PosOrderBook, ids: PosOrderIdFactory = newOrderId): PosOrderBook {
  if (book.orders.length >= POS_OPEN_ORDER_LIMIT) return book
  const order = blankOrder(ids(), 'order', formatOrderNumber(book.nextNumber))
  return {
    orders: [...book.orders, order],
    activeId: order.id,
    nextNumber: book.nextNumber + 1,
  }
}

export function selectPosOrder(book: PosOrderBook, id: string): PosOrderBook {
  if (!book.orders.some((order) => order.id === id) || book.activeId === id) return book
  return { ...book, activeId: id }
}

export function patchPosOrder(
  book: PosOrderBook,
  id: string,
  patch: Partial<Pick<PosOpenOrder, 'cart' | 'customerId' | 'note'>>,
): PosOrderBook {
  if (!book.orders.some((order) => order.id === id)) return book
  return {
    ...book,
    orders: book.orders.map((order) => (order.id === id ? { ...order, ...patch } : order)),
  }
}

/** Nothing sold yet — the tab can be removed. */
export function posOrderIsEmpty(order: PosOpenOrder) {
  return order.cart.length === 0
}

/** Remove an empty extra ticket. The register ticket, and any ticket with lines, stays. */
export function closePosOrder(book: PosOrderBook, id: string): PosOrderBook {
  const order = book.orders.find((row) => row.id === id)
  if (!order || order.kind !== 'order' || !posOrderIsEmpty(order)) return book
  return dropOrder(book, id)
}

/**
 * Payment finished for this ticket.
 * An extra ticket leaves the bar. The register ticket stays, emptied, so the
 * cashier still has a home order.
 */
export function settlePosOrder(book: PosOrderBook, id: string): PosOrderBook {
  const order = book.orders.find((row) => row.id === id)
  if (!order) return book
  if (order.kind === 'register') {
    return patchPosOrder(book, id, { cart: [], customerId: null, note: '' })
  }
  return dropOrder(book, id)
}

/** Cancel discards the ticket. An extra ticket is removed; the register ticket is emptied. */
export function clearPosOrder(book: PosOrderBook, id: string): PosOrderBook {
  const order = book.orders.find((row) => row.id === id)
  if (!order) return book
  if (order.kind === 'order') return dropOrder(book, id)
  return patchPosOrder(book, id, { cart: [], customerId: null, note: '' })
}

export function loadPosOrderBook(
  storage: PosOrderStorage | null,
  userId: string,
  sessionId: string,
  ids: PosOrderIdFactory = newOrderId,
): PosOrderBook {
  if (!storage) return createPosOrderBook(ids)
  try {
    const raw = storage.getItem(posOrderStorageKey(userId, sessionId))
    if (!raw) return createPosOrderBook(ids)
    return parseStored(JSON.parse(raw), userId, sessionId) ?? createPosOrderBook(ids)
  } catch {
    return createPosOrderBook(ids)
  }
}

export function savePosOrderBook(
  storage: PosOrderStorage | null,
  userId: string,
  sessionId: string,
  book: PosOrderBook,
) {
  if (!storage) return
  try {
    const payload = { version: STORAGE_VERSION, userId, sessionId, book }
    storage.setItem(posOrderStorageKey(userId, sessionId), JSON.stringify(payload))
  } catch {
    // Private mode or a full disk — the till still sells for this page view.
  }
}

function dropOrder(book: PosOrderBook, id: string): PosOrderBook {
  const orders = book.orders.filter((order) => order.id !== id)
  if (orders.length === 0 || !orders.some((order) => order.kind === 'register')) {
    return createPosOrderBook()
  }
  const activeStillThere = orders.some((order) => order.id === book.activeId)
  const register = orders.find((order) => order.kind === 'register')
  const activeId = activeStillThere ? book.activeId : (register?.id ?? orders[0]!.id)
  return { ...book, orders, activeId }
}

function blankOrder(id: string, kind: PosOpenOrder['kind'], label: string): PosOpenOrder {
  return { id, kind, label, cart: [], customerId: null, note: '' }
}

function formatOrderNumber(n: number) {
  return String(n).padStart(4, '0')
}

function newOrderId() {
  const cryptoObj = globalThis.crypto
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID()
  return `ord-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

function bumpNextNumber(book: PosOrderBook): PosOrderBook {
  let max = 0
  for (const order of book.orders) {
    if (order.kind !== 'order') continue
    const n = Number(order.label)
    if (Number.isInteger(n) && n > max) max = n
  }
  return { ...book, nextNumber: Math.max(book.nextNumber, max + 1) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseLine(value: unknown): PosOpenCartLine | null {
  if (!isRecord(value)) return null
  const { itemId, name, price, quantity, storeId } = value
  if (typeof itemId !== 'string' || itemId.length === 0 || itemId.length > 64) return null
  if (typeof name !== 'string' || name.length > 200) return null
  if (typeof price !== 'string' || price.length > 32) return null
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
    return null
  }
  if (storeId !== null && (typeof storeId !== 'string' || storeId.length === 0 || storeId.length > 64)) {
    return null
  }
  return { itemId, name, price, quantity, storeId }
}

function parseOrder(value: unknown): PosOpenOrder | null {
  if (!isRecord(value)) return null
  const { id, kind, label, cart, customerId, note } = value
  if (typeof id !== 'string' || id.length === 0 || id.length > 80) return null
  if (kind !== 'register' && kind !== 'order') return null
  if (typeof label !== 'string' || label.length === 0 || label.length > 40) return null
  if (kind === 'register' && label !== REGISTER_LABEL) return null
  if (!Array.isArray(cart) || cart.length > 100) return null
  const lines: PosOpenCartLine[] = []
  for (const line of cart) {
    const parsed = parseLine(line)
    if (!parsed) return null
    lines.push(parsed)
  }
  if (customerId !== null && (typeof customerId !== 'string' || customerId.length === 0 || customerId.length > 64)) {
    return null
  }
  if (typeof note !== 'string' || note.length > 500) return null
  return { id, kind, label, cart: lines, customerId, note }
}

function parseBook(value: unknown): PosOrderBook | null {
  if (!isRecord(value)) return null
  const { orders, activeId, nextNumber } = value
  if (!Array.isArray(orders) || orders.length === 0 || orders.length > POS_OPEN_ORDER_LIMIT) return null
  const parsed: PosOpenOrder[] = []
  for (const order of orders) {
    const row = parseOrder(order)
    if (!row) return null
    parsed.push(row)
  }
  if (parsed[0]?.kind !== 'register') return null
  if (parsed.filter((order) => order.kind === 'register').length !== 1) return null
  if (new Set(parsed.map((order) => order.id)).size !== parsed.length) return null
  if (typeof activeId !== 'string' || !parsed.some((order) => order.id === activeId)) return null
  if (typeof nextNumber !== 'number' || !Number.isInteger(nextNumber) || nextNumber < 1 || nextNumber > 100_000) {
    return null
  }
  return bumpNextNumber({ orders: parsed, activeId, nextNumber })
}

function parseStored(value: unknown, userId: string, sessionId: string): PosOrderBook | null {
  if (!isRecord(value)) return null
  if (value.version !== STORAGE_VERSION) return null
  if (value.userId !== userId || value.sessionId !== sessionId) return null
  return parseBook(value.book)
}

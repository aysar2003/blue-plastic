// @vitest-environment happy-dom

import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const checkoutCalls = vi.hoisted(() => [] as unknown[])

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  usePathname: () => '/pos/reg-1',
}))
vi.mock('@/app/(app)/pos/actions', () => ({
  closePosSession: async () => ({ ok: true, data: {} }),
  posCheckout: async (input: unknown) => {
    checkoutCalls.push(input)
    return { ok: true, data: { id: 'doc-1', number: 'SR-9', total: '12.00' } }
  },
  posRefund: async () => ({ ok: true, data: {} }),
  recordPosCashMove: async () => ({ ok: true, data: {} }),
}))
vi.mock('@/components/pos/register-lock', () => ({
  useClientReady: () => true,
  useRegisterLocked: () => false,
  writeRegisterLocked: () => {},
  RegisterLock: () => null,
}))

const { PosTerminal } = await import('@/components/pos/pos-terminal')

const props = {
  cashierUserId: 'cashier-1',
  register: { id: 'reg-1', name: 'Till 1', paymentMethods: [{ id: 'cash', name: 'Cash', isCash: true }] },
  session: { id: 'sess-1', dateLabel: '8 Oct 2026', openingCash: '$0.00' },
  cashSummary: { expectedCash: '0', cashIn: '0', cashOut: '0', cashSales: '0', cashRefunds: '0' },
  recentOrders: [],
  products: [
    { id: 'a4', name: 'A4', sku: null, category: null, price: '6', onHand: '10' },
    { id: 'bbb', name: '9BBB item', sku: null, category: null, price: '12', onHand: '4' },
  ],
  customers: [{ id: 'cust-1', displayName: 'Amina' }],
  currency: 'USD',
  orgName: 'Test Org',
}

let root: Root | null = null
let host: HTMLDivElement | null = null

function buttons() {
  return [...document.querySelectorAll('button')]
}

function buttonByText(text: string) {
  const found = buttons().find((el) => el.textContent?.trim() === text)
  if (!found) {
    throw new Error(`No button "${text}". Have: ${buttons().map((el) => el.textContent?.trim()).join(' | ')}`)
  }
  return found
}

function buttonIncluding(text: string) {
  const found = buttons().find((el) => el.textContent?.includes(text))
  if (!found) throw new Error(`No button including "${text}"`)
  return found
}

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

async function renderTill() {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root!.render(createElement(PosTerminal, props))
  })
}

function activeOrder() {
  return document.querySelector('[data-active-order]')?.getAttribute('data-active-order')
}

function cartText() {
  const panel = document.querySelector('aside')
  if (!panel) throw new Error('cart panel missing')
  return panel.textContent ?? ''
}

beforeEach(() => {
  checkoutCalls.length = 0
  localStorage.clear()
  window.open = () => null
})

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount()
    })
  }
  host?.remove()
  root = null
  host = null
})

describe('POS till tabs', () => {
  it('switches carts, customers and notes, then pays only the open ticket', async () => {
    await renderTill()

    expect(buttonByText('Register').getAttribute('aria-pressed')).toBe('true')
    expect(activeOrder()).toBe('Register')

    await click(buttonIncluding('A4'))
    expect(cartText()).toContain('A4')
    expect(cartText()).toContain('$6.00')

    await click(buttonByText('Customer'))
    await click(buttonByText('Amina'))
    expect(cartText()).toContain('Register · Amina')

    await click(buttonIncluding('Note'))
    const note = document.querySelector('textarea')
    if (!note) throw new Error('note field missing')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(note, 'front desk')
      note.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click(buttonByText('Done'))
    expect(buttonIncluding('Note').textContent).toContain('·')

    await click(document.querySelector('[aria-label="New order"]')!)
    expect(buttonByText('0001').getAttribute('aria-pressed')).toBe('true')
    expect(activeOrder()).toBe('0001')
    expect(cartText()).toContain('Tap a product or scan a barcode.')
    expect(cartText()).not.toContain('Amina')
    expect(cartText()).not.toContain('A4')

    await click(buttonIncluding('9BBB item'))
    await click(buttonByText('Customer'))
    await click(buttonByText('Amina'))
    expect(cartText()).toContain('Order 0001 · Amina')
    expect(cartText()).toContain('$12.00')

    await click(buttonByText('Register'))
    expect(activeOrder()).toBe('Register')
    expect(cartText()).toContain('Register · Amina')
    expect(cartText()).toContain('A4')
    expect(cartText()).toContain('$6.00')
    expect(cartText()).not.toContain('9BBB item')

    await click(buttonByText('0001'))
    expect(cartText()).toContain('9BBB item')
    expect(cartText()).toContain('$12.00')
    expect(cartText()).not.toContain('A4')

    await click(buttonByText('Payment'))
    await click(buttonByText('Exact'))
    await click(buttonByText('Validate'))

    expect(checkoutCalls).toEqual([
      {
        registerId: 'reg-1',
        sessionId: 'sess-1',
        customerId: 'cust-1',
        note: null,
        lines: [{ itemId: 'bbb', quantity: '1', storeId: undefined }],
        payments: [{ paymentMethodId: 'cash', amount: '12.00' }],
      },
    ])
    expect(document.body.textContent).toContain('Receipt SR-9')
    expect(buttons().some((el) => el.textContent?.trim() === '0001')).toBe(false)
    expect(activeOrder()).toBe('Register')
    expect(cartText()).toContain('A4')
    expect(cartText()).toContain('$6.00')
    expect(cartText()).not.toContain('9BBB item')
  })

  it('drops an empty extra ticket and restores both carts after a remount', async () => {
    await renderTill()
    await click(buttonIncluding('A4'))
    await click(document.querySelector('[aria-label="New order"]')!)
    await click(buttonIncluding('9BBB item'))
    await click(document.querySelector('[aria-label="New order"]')!)
    expect(buttonByText('0002').getAttribute('aria-pressed')).toBe('true')

    await click(document.querySelector('[aria-label="Close order 0002"]')!)
    expect(buttons().some((el) => el.textContent?.trim() === '0002')).toBe(false)
    expect(activeOrder()).toBe('Register')
    expect(cartText()).toContain('A4')

    await act(async () => {
      root!.unmount()
    })
    host?.remove()
    root = null
    host = null
    await renderTill()

    expect(buttonByText('0001')).toBeTruthy()
    expect(cartText()).toContain('A4')
    expect(cartText()).not.toContain('9BBB item')
    await click(buttonByText('0001'))
    expect(cartText()).toContain('9BBB item')
    expect(cartText()).toContain('$12.00')
    expect(cartText()).not.toContain('A4')
  })
})

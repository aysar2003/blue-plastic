import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  usePathname: () => '/pos/reg-1',
}))
vi.mock('@/app/(app)/pos/actions', () => ({
  closePosSession: async () => ({ ok: true, data: {} }),
  posCheckout: async () => ({ ok: true, data: {} }),
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

function render() {
  return renderToString(
    createElement(PosTerminal, {
      cashierUserId: 'user-1',
      register: { id: 'reg-1', name: 'Till 1', paymentMethods: [{ id: 'cash', name: 'Cash', isCash: true }] },
      session: { id: 'sess-1', dateLabel: '8 Oct 2026', openingCash: '$0.00' },
      cashSummary: { expectedCash: '0', cashIn: '0', cashOut: '0', cashSales: '0', cashRefunds: '0' },
      recentOrders: [],
      products: [{ id: 'a4', name: 'A4', sku: null, category: null, price: '6', onHand: '10' }],
      customers: [],
      currency: 'USD',
      orgName: 'Test Org',
    }),
  )
}

describe('POS order tabs', () => {
  it('renders Register as a selected tab and + as a new-order button', () => {
    const html = render()
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Register<\/button>/)
    expect(html).toContain('aria-label="New order"')
    expect(html).toContain('>Orders<')
    // The old session-id chip was not an order. A fresh till has only Register.
    expect(html).not.toContain('9BBB')
    expect(html).toContain('Tap a product or scan a barcode.')
  })
})

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// Render the till with props only: no session, no database, no server actions.
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

function render(products: { id: string; name: string; onHand: string | null }[]) {
  return renderToString(
    createElement(PosTerminal, {
      register: { id: 'reg-1', name: 'Till 1', paymentMethods: [{ id: 'cash', name: 'Cash', isCash: true }] },
      session: { id: 'sess-1', dateLabel: '8 Oct 2026', openingCash: '$0.00', orderBadge: 'S001' },
      cashSummary: { expectedCash: '0', cashIn: '0', cashOut: '0', cashSales: '0', cashRefunds: '0' },
      recentOrders: [],
      products: products.map((product) => ({ ...product, sku: null, category: null, price: '10' })),
      stockStoreName: 'Xafiiska',
      customers: [],
      currency: 'USD',
      orgName: 'Test Org',
    }),
  )
}

/** Visible text of every amber stock note in the markup. */
function notes(html: string) {
  return [...html.matchAll(/<p role="status"[^>]*>.*?<span>(.*?)<\/span><\/p>/g)].map((match) =>
    match[1].replace(/<!-- -->/g, ''),
  )
}

describe('POS stock warning (product tiles)', () => {
  it('marks products at or below zero and leaves stocked items and services alone', () => {
    const html = render([
      { id: 'aasto', name: 'AASTO', onHand: '-7.0000' },
      { id: 'aresto', name: 'ARESTO GERMANY', onHand: '0.0000' },
      { id: 'a4', name: 'A4', onHand: '100.0000' },
      { id: 'svc', name: 'Delivery', onHand: null },
    ])
    expect(notes(html)).toEqual([
      'Stock: \u22127 left \u2014 will go negative',
      'Stock: 0 left \u2014 will go negative',
    ])
  })

  it('never disables a product tile because of stock', () => {
    const html = render([{ id: 'aasto', name: 'AASTO', onHand: '-7.0000' }])
    const tile = html.slice(html.lastIndexOf('<button', html.indexOf('AASTO')), html.indexOf('AASTO'))
    expect(tile).not.toContain('disabled')
  })
})

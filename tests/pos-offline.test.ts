import { describe, expect, it } from 'vitest'

import { sortPendingFifo } from '@/lib/pos-offline/queue'
import type { PosOfflinePendingSale } from '@/lib/pos-offline/types'
import { posCheckoutSchema } from '@/lib/validation/pos'

function sale(
  partial: Partial<PosOfflinePendingSale> & Pick<PosOfflinePendingSale, 'clientSaleId' | 'createdAt'>,
): PosOfflinePendingSale {
  return {
    registerId: 'reg-1',
    sessionId: 'sess-1',
    lines: [{ itemId: 'item-1', quantity: '1' }],
    payments: [{ paymentMethodId: 'cash', amount: '10.00' }],
    localStatus: 'pending',
    totalLabel: '$10.00',
    ...partial,
  }
}

describe('pos offline queue FIFO', () => {
  it('orders pending sales by createdAt ascending', () => {
    const rows = [
      sale({ clientSaleId: 'b', createdAt: '2026-11-13T12:00:00.000Z' }),
      sale({ clientSaleId: 'a', createdAt: '2026-11-13T11:00:00.000Z' }),
      sale({ clientSaleId: 'c', createdAt: '2026-11-13T13:00:00.000Z' }),
    ]
    expect(sortPendingFifo(rows).map((row) => row.clientSaleId)).toEqual(['a', 'b', 'c'])
  })
})

describe('posCheckoutSchema clientSaleId', () => {
  const base = {
    registerId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
    sessionId: 'clxxxxxxxxxxxxxxxxxxxxxxxx2',
    lines: [{ itemId: 'clxxxxxxxxxxxxxxxxxxxxxxxx3', quantity: '1' }],
    payments: [{ paymentMethodId: 'clxxxxxxxxxxxxxxxxxxxxxxxx4', amount: '5.00' }],
  }

  it('accepts a stable offline id for idempotent sync', () => {
    const parsed = posCheckoutSchema.parse({
      ...base,
      clientSaleId: '11111111-2222-4333-8444-555555555555',
    })
    expect(parsed.clientSaleId).toBe('11111111-2222-4333-8444-555555555555')
  })

  it('allows checkout without clientSaleId (online sale)', () => {
    const parsed = posCheckoutSchema.parse(base)
    expect(parsed.clientSaleId).toBeUndefined()
  })

  it('rejects a tiny offline id', () => {
    expect(() => posCheckoutSchema.parse({ ...base, clientSaleId: 'short' })).toThrow()
  })
})

describe('offline sync idempotency contract', () => {
  it('keeps the same clientSaleId across retries so checkout can no-op', () => {
    const clientSaleId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    const first = posCheckoutSchema.parse({
      registerId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
      sessionId: 'clxxxxxxxxxxxxxxxxxxxxxxxx2',
      lines: [{ itemId: 'clxxxxxxxxxxxxxxxxxxxxxxxx3', quantity: '2' }],
      payments: [{ paymentMethodId: 'clxxxxxxxxxxxxxxxxxxxxxxxx4', amount: '12.00' }],
      clientSaleId,
    })
    const retry = posCheckoutSchema.parse({
      registerId: first.registerId,
      sessionId: first.sessionId,
      lines: first.lines,
      payments: first.payments,
      tipAmount: first.tipAmount,
      clientSaleId: first.clientSaleId,
    })
    expect(retry.clientSaleId).toBe(clientSaleId)
    expect(retry.payments).toEqual(first.payments)
  })
})

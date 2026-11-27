import { describe, expect, it } from 'vitest'

import {
  addLaborCharge,
  addLaborCost,
  emptySlice,
  profitOf,
} from '@/lib/project-profitability'
import { waveLabelCsvRows } from '@/lib/erp/wms-bin'
import { dispatchSignWebhook, parseSignProvider } from '@/lib/erp/sign-provider'

describe('Wave H — job P&L cost vs charge', () => {
  it('subtracts cost from profit and leaves charge as display-only', () => {
    let slice = emptySlice()
    slice = addLaborCost(slice, '4', '25')
    slice = addLaborCharge(slice, '4', '80')
    expect(slice.laborCost.toFixed(0)).toBe('100')
    expect(slice.laborCharge.toFixed(0)).toBe('320')
    expect(profitOf(slice).toFixed(0)).toBe('-100')
  })
})

describe('Wave H — wave shipping labels CSV', () => {
  it('emits order / ship-to / carrier columns', () => {
    const rows = waveLabelCsvRows([
      {
        waveNumber: 'W-1',
        orderNumber: 'SO-9',
        customerName: 'Acme',
        shipTo: 'Dock 2, Hargeisa',
        carrier: 'DHL',
        itemName: 'Pipe',
        sku: 'P-1',
        qty: '3',
      },
    ])
    expect(rows[0]).toEqual(['W-1', 'SO-9', 'Acme', 'Dock 2, Hargeisa', 'DHL', 'Pipe', 'P-1', '3'])
  })
})

describe('Wave H — outbound sign webhook', () => {
  it('posts HMAC and returns provider external id', async () => {
    const config = parseSignProvider({
      kind: 'webhook',
      webhookUrl: 'https://signer.example/hook',
      webhookSecret: 'secret',
    })
    const result = await dispatchSignWebhook(
      config,
      {
        requestId: 'req-1',
        title: 'Quote',
        token: 'tok',
        signerEmail: 'a@b.co',
        organizationName: 'Org',
      },
      async () =>
        new Response(JSON.stringify({ externalId: 'ext-9' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    expect(result.ok).toBe(true)
    expect(result.externalId).toBe('ext-9')
  })

  it('returns ok:false on HTTP error without throwing', async () => {
    const config = parseSignProvider({
      kind: 'webhook',
      webhookUrl: 'https://signer.example/hook',
    })
    const result = await dispatchSignWebhook(
      config,
      {
        requestId: 'req-2',
        title: 'Bill',
        token: null,
        signerEmail: null,
        organizationName: 'Org',
      },
      async () => new Response('nope', { status: 502 }),
    )
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/502/)
  })
})

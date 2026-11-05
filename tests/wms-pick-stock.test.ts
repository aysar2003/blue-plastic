import { describe, expect, it } from 'vitest'

import { canCancelPick } from '@/lib/erp/wms-pick'
import { positionOf, recordMovement } from '@/server/accounting/inventory'
import type { Tx } from '@/server/db'
import { CODE, inRolledBackTransaction, makeOrg, type Fixture } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

async function makePart(tx: Tx, fixture: Fixture, name: string, cost: string, qty: string) {
  const item = await tx.item.create({
    data: {
      orgId: fixture.ctx.orgId,
      name,
      type: 'INVENTORY',
      incomeAccountId: fixture.accounts[CODE.sales],
      inventoryAccountId: fixture.accounts['1200'],
      cogsAccountId: fixture.accounts['5000'],
      purchaseCost: cost,
    },
    select: { id: true },
  })
  await recordMovement(tx, fixture.ctx, {
    itemId: item.id,
    date: '2026-03-01',
    type: 'PURCHASE',
    sourceType: 'BILL',
    quantity: qty,
    unitCost: cost,
  })
  return item
}

describe('pick cancel after picked', () => {
  it('refuses cancel once picked', () => {
    expect(canCancelPick('PICKED')).toBe(false)
    expect(canCancelPick('OPEN')).toBe(true)
  })
})

suite('WMS pick posts stock', () => {
  it('completing a pick reduces on-hand and blocks cancel', async () => {
    const wms = await import('@/server/services/wms.service')
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const part = await makePart(tx, fixture, 'Pick Widget', '3', '10')
      const store = await tx.store.create({
        data: {
          orgId: fixture.ctx.orgId,
          name: 'Pick Store',
          inventoryAccountId: fixture.accounts['1200'],
        },
        select: { id: true },
      })

      const pick = await tx.pickTask.create({
        data: {
          orgId: fixture.ctx.orgId,
          storeId: store.id,
          itemId: part.id,
          qty: '4',
          status: 'PICKING',
        },
        select: { id: true },
      })

      await wms.completePickInTx(tx, fixture.ctx, pick.id)
      expect((await positionOf(tx, part.id)).quantity.toString()).toBe('6')

      const status = await tx.pickTask.findUnique({
        where: { id: pick.id },
        select: { status: true },
      })
      expect(status?.status).toBe('PICKED')
      expect(canCancelPick(status!.status as 'PICKED')).toBe(false)
    })
  })
})

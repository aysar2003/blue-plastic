import { describe, expect, it } from 'vitest'

import {
  canCompletePutaway,
  canReleaseWave,
  nextBinRunning,
  refuseShortBin,
  waveNumberFromSeq,
} from '@/lib/erp/wms-bin'
import { positionOf, recordMovement } from '@/server/accounting/inventory'
import type { Tx } from '@/server/db'
import { CODE, inRolledBackTransaction, makeOrg, type Fixture } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

describe('wms bin helpers', () => {
  it('tracks running qty and short bins', () => {
    expect(nextBinRunning('10', '4').toString()).toBe('14')
    expect(nextBinRunning('10', '-3').toString()).toBe('7')
    expect(refuseShortBin('2', '5')).toBe(true)
    expect(refuseShortBin('5', '5')).toBe(false)
    expect(canCompletePutaway('OPEN')).toBe(true)
    expect(canReleaseWave('OPEN')).toBe(true)
    expect(waveNumberFromSeq(3)).toBe('WV-00003')
  })
})

suite('wms bin ledger', () => {
  it('putaway raises bin qty; pick from bin reduces item and bin', async () => {
    const wms = await import('@/server/services/wms.service')
    await inRolledBackTransaction(async (tx: Tx) => {
      const fixture = await makeOrg(tx)
      const item = await tx.item.create({
        data: {
          orgId: fixture.ctx.orgId,
          name: 'Bin Part',
          type: 'INVENTORY',
          incomeAccountId: fixture.accounts[CODE.sales],
          inventoryAccountId: fixture.accounts['1200'],
          cogsAccountId: fixture.accounts['5000'],
          purchaseCost: '2',
        },
        select: { id: true },
      })
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id,
        date: '2026-03-01',
        type: 'PURCHASE',
        sourceType: 'BILL',
        quantity: '20',
        unitCost: '2',
      })
      const store = await tx.store.create({
        data: {
          orgId: fixture.ctx.orgId,
          name: 'Bin Store',
          inventoryAccountId: fixture.accounts['1200'],
        },
        select: { id: true },
      })
      const bin = await tx.stockBin.create({
        data: { orgId: fixture.ctx.orgId, storeId: store.id, code: 'A-01', name: 'A-01' },
        select: { id: true },
      })
      const putaway = await tx.putawayTask.create({
        data: {
          orgId: fixture.ctx.orgId,
          storeId: store.id,
          itemId: item.id,
          binId: bin.id,
          qty: '8',
          status: 'OPEN',
        },
        select: { id: true },
      })
      await wms.completePutawayInTx(tx, fixture.ctx, putaway.id)
      const binRow = await tx.binMovement.findFirst({
        where: { orgId: fixture.ctx.orgId, binId: bin.id, itemId: item.id },
        orderBy: { createdAt: 'desc' },
      })
      expect(binRow?.runningQuantity.toString()).toBe('8')

      const pick = await tx.pickTask.create({
        data: {
          orgId: fixture.ctx.orgId,
          storeId: store.id,
          itemId: item.id,
          binId: bin.id,
          qty: '3',
          status: 'PICKING',
        },
        select: { id: true },
      })
      await wms.completePickInTx(tx, fixture.ctx, pick.id)
      expect((await positionOf(tx, item.id)).quantity.toString()).toBe('17')
      const after = await tx.binMovement.findFirst({
        where: { orgId: fixture.ctx.orgId, binId: bin.id, itemId: item.id },
        orderBy: { createdAt: 'desc' },
      })
      expect(after?.runningQuantity.toString()).toBe('5')
    })
  })
})

import { describe, expect, it } from 'vitest'

import { canCancelWorkOrder, canCompleteWorkOrder, canReleaseWorkOrder } from '@/lib/erp/work-order'
import { positionOf, recordMovement } from '@/server/accounting/inventory'
import type { Tx } from '@/server/db'
import * as workOrderService from '@/server/services/work-order.service'
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

async function makeAssembly(
  tx: Tx,
  fixture: Fixture,
  name: string,
  bom: { itemId: string; quantity: string }[],
) {
  const assembly = await tx.item.create({
    data: {
      orgId: fixture.ctx.orgId,
      name,
      type: 'INVENTORY_ASSEMBLY',
      incomeAccountId: fixture.accounts[CODE.sales],
      inventoryAccountId: fixture.accounts['1200'],
      cogsAccountId: fixture.accounts['5000'],
      salesPrice: '5',
    },
    select: { id: true },
  })
  for (const [index, row] of bom.entries()) {
    await tx.itemComponent.create({
      data: {
        orgId: fixture.ctx.orgId,
        parentItemId: assembly.id,
        componentItemId: row.itemId,
        quantity: row.quantity,
        sortOrder: index,
      },
    })
  }
  return assembly
}

describe('work order status guards', () => {
  it('releases draft, completes released, cancels draft/released', () => {
    expect(canReleaseWorkOrder('DRAFT')).toBe(true)
    expect(canReleaseWorkOrder('RELEASED')).toBe(false)
    expect(canCompleteWorkOrder('RELEASED')).toBe(true)
    expect(canCompleteWorkOrder('DRAFT')).toBe(false)
    expect(canCancelWorkOrder('DONE')).toBe(false)
    expect(canCancelWorkOrder('DRAFT')).toBe(true)
  })
})

suite('work orders posting', () => {
  it('complete posts stock via assembly build; cancel does not', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const sugar = await makePart(tx, fixture, 'WO Sugar', '2', '20')
      const tea = await makeAssembly(tx, fixture, 'WO Tea', [{ itemId: sugar.id, quantity: '0.5' }])

      const wo = await tx.workOrder.create({
        data: {
          orgId: fixture.ctx.orgId,
          number: 'WO-TEST-1',
          date: new Date('2026-03-10'),
          itemId: tea.id,
          quantity: '10',
          status: 'RELEASED',
        },
        select: { id: true },
      })
      await tx.workOrderLine.create({
        data: {
          orgId: fixture.ctx.orgId,
          workOrderId: wo.id,
          lineNumber: 1,
          itemId: sugar.id,
          quantity: '5',
        },
      })

      const done = await workOrderService.completeInTx(tx, fixture.ctx, wo.id, '2026-03-10')
      expect(done.buildNumber).toBeTruthy()
      expect((await positionOf(tx, sugar.id)).quantity.toString()).toBe('15')
      expect((await positionOf(tx, tea.id)).quantity.toString()).toBe('10')

      const cancelled = await tx.workOrder.create({
        data: {
          orgId: fixture.ctx.orgId,
          number: 'WO-TEST-2',
          date: new Date('2026-03-10'),
          itemId: tea.id,
          quantity: '2',
          status: 'CANCELLED',
        },
        select: { id: true },
      })
      await expect(workOrderService.completeInTx(tx, fixture.ctx, cancelled.id, '2026-03-10')).rejects.toThrow(
        /released/i,
      )
      expect((await positionOf(tx, tea.id)).quantity.toString()).toBe('10')
    })
  })
})

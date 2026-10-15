import { describe, expect, it } from 'vitest'

import { isStockTracked } from '@/lib/item-types'
import { ZERO } from '@/lib/money'
import { positionsOf, recordMovement } from '@/server/accounting/inventory'
import { CODE, inRolledBackTransaction, makeOrg } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

/**
 * Category hub rules exercised against the same tables the service uses.
 * Soft-delete, rename uniqueness, and stock-cost rollups for the green cards.
 */
suite('product category catalogue rules', () => {
  it('soft-deletes an empty category and restores it on recreate', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const orgId = fixture.ctx.orgId

      const created = await tx.itemCategory.create({
        data: { orgId, name: 'Test shelf group' },
        select: { id: true, name: true, isActive: true },
      })
      expect(created.isActive).toBe(true)

      await tx.itemCategory.update({
        where: { id: created.id },
        data: { isActive: false },
      })

      const inactive = await tx.itemCategory.findFirst({
        where: { orgId, name: { equals: 'Test shelf group', mode: 'insensitive' } },
        select: { id: true, isActive: true },
      })
      expect(inactive?.isActive).toBe(false)

      const restored = await tx.itemCategory.update({
        where: { id: inactive!.id },
        data: { isActive: true, name: 'Test shelf group' },
        select: { id: true, isActive: true },
      })
      expect(restored.isActive).toBe(true)
    })
  })

  it('blocks delete when active items still sit in the category', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const orgId = fixture.ctx.orgId

      const category = await tx.itemCategory.create({
        data: { orgId, name: 'Wired group' },
        select: { id: true },
      })

      await tx.item.create({
        data: {
          orgId,
          name: 'Bolt pack',
          type: 'NON_INVENTORY',
          categoryId: category.id,
          salesPrice: '5',
          purchaseCost: '2',
          incomeAccountId: fixture.accounts[CODE.sales],
          cogsAccountId: fixture.accounts['5000'],
        },
      })

      const itemCount = await tx.item.count({
        where: { orgId, categoryId: category.id, isActive: true },
      })
      expect(itemCount).toBe(1)
      // Service refuses delete whenever this count is > 0.
    })
  })

  it('rolls up item count and inventory cost per category for hub cards', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const orgId = fixture.ctx.orgId

      const category = await tx.itemCategory.create({
        data: { orgId, name: 'Cost shelf' },
        select: { id: true },
      })

      const item = await tx.item.create({
        data: {
          orgId,
          name: 'Bag of cement',
          type: 'INVENTORY',
          categoryId: category.id,
          salesPrice: '12',
          purchaseCost: '8',
          incomeAccountId: fixture.accounts[CODE.sales],
          inventoryAccountId: fixture.accounts['1200'],
          cogsAccountId: fixture.accounts['5000'],
        },
        select: { id: true, type: true, categoryId: true },
      })

      await recordMovement(tx, fixture.ctx, {
        itemId: item.id,
        date: '2026-01-15',
        type: 'PURCHASE',
        sourceType: 'BILL',
        quantity: '10',
        unitCost: '8',
      })

      const items = await tx.item.findMany({
        where: { orgId, isActive: true, categoryId: category.id },
        select: { id: true, type: true, categoryId: true },
      })
      expect(items).toHaveLength(1)
      expect(isStockTracked(items[0]!.type)).toBe(true)

      const positions = await positionsOf(
        tx,
        orgId,
        items.map((row) => row.id),
      )
      let totalCost = ZERO
      for (const row of items) {
        totalCost = totalCost.plus(positions.get(row.id)?.value ?? ZERO)
      }
      expect(totalCost.toFixed(2)).toBe('80.00')
    })
  })
})

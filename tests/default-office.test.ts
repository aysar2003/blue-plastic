import { describe, expect, it } from 'vitest'

import { generatedOfficeWording, seedDefaultOffice } from '@/server/accounting/default-office'
import { inRolledBackTransaction, makeOrg } from './ledger-helpers'

describe('chart account type', () => {
  it('uses the original chart inventory type and clears a custom office detail', () => {
    const replaced = generatedOfficeWording({
      description: 'Inventory held at Xafiiska. Listed with Inventory Asset.',
      detailType: 'Store',
    })
    expect(replaced.detailType).toBeNull()
    expect(replaced.description).toBe('Stock on hand, at weighted-average cost.')
    expect(
      generatedOfficeWording({
        description: 'Default place for this company. New sales start here.',
        detailType: 'Xafiiska',
      }).detailType,
    ).toBeNull()
    expect(generatedOfficeWording({ description: 'Main door', detailType: null })).toEqual({})
  })
})

const suite = process.env.DATABASE_URL ? describe : describe.skip

suite('Xafiiska default', () => {
  it('keeps the original chart and does not add an office account to it', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const inventory = await tx.ledgerAccount.findFirst({
        where: { orgId: fixture.ctx.orgId, code: '1200' },
        select: { id: true },
      })

      const first = await seedDefaultOffice(tx, fixture.ctx.orgId)
      expect(first).not.toBeNull()
      expect(
        await tx.ledgerAccount.findFirst({
          where: { orgId: fixture.ctx.orgId, name: 'Xafiiska' },
          select: { id: true },
        }),
      ).toBeNull()

      const store = await tx.store.findFirst({
        where: { orgId: fixture.ctx.orgId, name: 'Xafiiska' },
        select: { id: true, isOffice: true, inventoryAccountId: true },
      })
      expect(store).toMatchObject({ id: first?.id, isOffice: true, inventoryAccountId: inventory?.id })
      expect(await tx.store.count({ where: { orgId: fixture.ctx.orgId, name: 'Xafiiska' } })).toBe(1)
      expect((await seedDefaultOffice(tx, fixture.ctx.orgId))?.id).toBe(first?.id)
    })
  })
})

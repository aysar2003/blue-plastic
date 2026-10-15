import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { positionOf, recordMovement } from '@/server/accounting/inventory'
import { db, type Tx } from '@/server/db'
import * as assemblyBuildService from '@/server/services/assembly-build.service'
import { postDocument } from '@/server/services/sales.service'
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
    select: { id: true, name: true },
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
  inventoryAccountId?: string,
) {
  const assembly = await tx.item.create({
    data: {
      orgId: fixture.ctx.orgId,
      name,
      type: 'INVENTORY_ASSEMBLY',
      incomeAccountId: fixture.accounts[CODE.sales],
      inventoryAccountId: inventoryAccountId ?? fixture.accounts['1200'],
      cogsAccountId: fixture.accounts['5000'],
      salesPrice: '5',
    },
    select: { id: true, name: true },
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

suite('assembly builds', () => {
  it('consumes components at average and values finished units at materials cost', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const sugar = await makePart(tx, fixture, 'Sokor', '2', '20')
      const water = await makePart(tx, fixture, 'Biyo', '1', '50')
      const leaves = await makePart(tx, fixture, 'Caleen', '0.5', '100')
      const tea = await makeAssembly(tx, fixture, 'Shaah cup', [
        { itemId: sugar.id, quantity: '0.5' },
        { itemId: water.id, quantity: '2' },
        { itemId: leaves.id, quantity: '3' },
      ])

      const built = await assemblyBuildService.createInTx(tx, fixture.ctx, {
        number: '',
        date: '2026-03-10',
        itemId: tea.id,
        quantity: '20',
      })

      // Per cup: 0.5×2 + 2×1 + 3×0.5 = 4.5
      expect(built.unitCost).toBe('4.5')
      expect(built.value).toBe('90')

      expect((await positionOf(tx, sugar.id)).quantity.toString()).toBe('10')
      expect((await positionOf(tx, water.id)).quantity.toString()).toBe('10')
      expect((await positionOf(tx, leaves.id)).quantity.toString()).toBe('40')

      const teaPos = await positionOf(tx, tea.id)
      expect(teaPos.quantity.toString()).toBe('20')
      expect(teaPos.averageCost.toString()).toBe('4.5')

      const sale = await recordMovement(tx, fixture.ctx, {
        itemId: tea.id,
        date: '2026-03-11',
        type: 'SALE',
        sourceType: 'INVOICE',
        quantity: '-5',
      })
      expect(sale.unitCost.toString()).toBe('4.5')
      expect(sale.value.toString()).toBe('-22.5')
    })
  })

  it('refuses selling an assembly that has not been built yet', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      fixture.ctx.organization.allowNegativeStock = true

      const sugar = await makePart(tx, fixture, 'Sokor unbuilt', '2', '20')
      const tea = await makeAssembly(tx, fixture, 'Shaah unbuilt', [
        { itemId: sugar.id, quantity: '1' },
      ])
      const customer = await tx.customer.create({
        data: { orgId: fixture.ctx.orgId, displayName: 'Buyer' },
        select: { id: true },
      })
      const doc = await tx.salesDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'SALES_RECEIPT',
          number: 'SR-UNBUILT',
          customerId: customer.id,
          date: new Date('2026-03-12'),
          status: 'OPEN',
          subtotal: '5',
          taxTotal: '0',
          total: '5',
          currencyCode: 'USD',
          depositAccountId: fixture.accounts[CODE.bank],
          lines: {
            create: [
              {
                orgId: fixture.ctx.orgId,
                lineNumber: 1,
                itemId: tea.id,
                quantity: '1',
                unitPrice: '5',
                amount: '5',
                incomeAccountId: fixture.accounts[CODE.sales],
              },
            ],
          },
        },
        select: { id: true },
      })

      await expect(postDocument(tx, fixture.ctx, doc.id)).rejects.toThrow(/build them first/i)
    })
  })

  it('refuses a build when components are short and negative stock is off', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await tx.organization.update({
        where: { id: fixture.ctx.orgId },
        data: { allowNegativeStock: false },
      })
      fixture.ctx.organization.allowNegativeStock = false

      const sugar = await makePart(tx, fixture, 'Sokor short', '2', '1')
      const tea = await makeAssembly(tx, fixture, 'Shaah short', [
        { itemId: sugar.id, quantity: '0.5' },
      ])

      await expect(
        assemblyBuildService.createInTx(tx, fixture.ctx, {
          number: '',
          date: '2026-03-10',
          itemId: tea.id,
          quantity: '20',
        }),
      ).rejects.toThrow(/needs 10/)
    })
  })

  it('posts a balanced inventory reclass when the assembly uses a different account', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const otherInv = await tx.ledgerAccount.create({
        data: {
          orgId: fixture.ctx.orgId,
          code: '1210',
          name: 'Finished goods',
          type: 'ASSET',
          subtype: 'INVENTORY',
        },
        select: { id: true },
      })
      const sugar = await makePart(tx, fixture, 'Sokor FG', '2', '20')
      const tea = await makeAssembly(
        tx,
        fixture,
        'Shaah FG',
        [{ itemId: sugar.id, quantity: '1' }],
        otherInv.id,
      )

      const built = await assemblyBuildService.createInTx(tx, fixture.ctx, {
        number: '',
        date: '2026-03-10',
        itemId: tea.id,
        quantity: '5',
      })

      expect(built.unitCost).toBe('2')
      expect(built.value).toBe('10')

      const journal = await tx.journal.findFirst({
        where: { orgId: fixture.ctx.orgId, sourceType: 'ASSEMBLY_BUILD', sourceId: built.id },
        select: {
          lines: { select: { debit: true, credit: true, accountId: true } },
        },
      })
      expect(journal).toBeTruthy()
      const debit = journal!.lines.reduce(
        (sum, line) => sum.plus(line.debit?.toString() ?? 0),
        new Decimal(0),
      )
      const credit = journal!.lines.reduce(
        (sum, line) => sum.plus(line.credit?.toString() ?? 0),
        new Decimal(0),
      )
      expect(debit.toString()).toBe(credit.toString())
      expect(debit.toString()).toBe('10')
      expect(journal!.lines.some((line) => line.accountId === otherInv.id)).toBe(true)
      expect(journal!.lines.some((line) => line.accountId === fixture.accounts['1200'])).toBe(true)
    })
  })
})

// Silence unused when DATABASE_URL is unset and the suite is skipped.
void db

import { describe, expect, it } from 'vitest'

import { positionOf, recordMovement } from '@/server/accounting/inventory'
import { postJournal } from '@/server/accounting/posting'
import { Decimal } from '@/lib/money'
import { type Tx } from '@/server/db'
import * as landedCostService from '@/server/services/landed-cost.service'
import { CODE, inRolledBackTransaction, makeOrg, type Fixture } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

async function makeTrackedItem(tx: Tx, fixture: Fixture, name = 'Blue pipe') {
  return tx.item.create({
    data: {
      orgId: fixture.ctx.orgId,
      name,
      type: 'INVENTORY',
      incomeAccountId: fixture.accounts[CODE.sales],
      inventoryAccountId: fixture.accounts['1200'],
      cogsAccountId: fixture.accounts['5000'],
      purchaseCost: '10.0000',
    },
    select: { id: true, name: true },
  })
}

async function postedFreightBill(
  tx: Tx,
  fixture: Fixture,
  freight: string,
) {
  const vendor = await tx.vendor.create({
    data: { orgId: fixture.ctx.orgId, displayName: 'Freight Co' },
    select: { id: true },
  })
  const bill = await tx.purchaseDocument.create({
    data: {
      orgId: fixture.ctx.orgId,
      type: 'BILL',
      number: 'BILL-LC-1',
      vendorId: vendor.id,
      date: new Date('2026-04-01'),
      status: 'OPEN',
      subtotal: freight,
      taxTotal: '0',
      total: freight,
      currencyCode: 'USD',
      lines: {
        create: [
          {
            orgId: fixture.ctx.orgId,
            lineNumber: 1,
            description: 'Ocean freight',
            quantity: '1',
            unitPrice: freight,
            amount: freight,
            expenseAccountId: fixture.accounts['5100'],
          },
        ],
      },
    },
    select: { id: true, number: true },
  })
  const journal = await postJournal(tx, fixture.ctx, {
    date: '2026-04-01',
    memo: 'Freight bill',
    sourceType: 'BILL',
    sourceId: bill.id,
    lines: [
      { accountId: fixture.accounts['5100'], debit: freight, description: 'Freight' },
      { accountId: fixture.accounts[CODE.payable], credit: freight, description: 'AP' },
    ],
  })
  await tx.purchaseDocument.update({
    where: { id: bill.id },
    data: { journalId: journal.id },
  })
  return bill
}

suite('landed cost allocation', () => {
  it('adds freight onto weighted-average cost and posts inventory vs expense', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id,
        date: '2026-03-01',
        type: 'PURCHASE',
        sourceType: 'BILL',
        quantity: '10',
        unitCost: '10',
      })
      const bill = await postedFreightBill(tx, fixture, '20')

      const result = await landedCostService.allocateInTx(tx, fixture.ctx, {
        billId: bill.id,
        memo: 'Duty',
        lines: [{ itemId: item.id, amount: '20' }],
      })

      expect(result.total).toBe('20.0000')
      const position = await positionOf(tx, item.id)
      expect(position.quantity.toString()).toBe('10')
      expect(position.value.toString()).toBe('120')
      expect(position.averageCost.toString()).toBe('12')

      const journal = await tx.journal.findUniqueOrThrow({
        where: { id: result.journalId },
        select: {
          sourceType: true,
          lines: { select: { debit: true, credit: true, account: { select: { code: true } } } },
        },
      })
      expect(journal.sourceType).toBe('LANDED_COST')
      const debitInv = journal.lines
        .filter((line) => line.account.code === '1200')
        .reduce((sum, line) => sum.plus(line.debit.toString()), new Decimal(0))
      const creditFreight = journal.lines
        .filter((line) => line.account.code === '5100')
        .reduce((sum, line) => sum.plus(line.credit.toString()), new Decimal(0))
      expect(debitInv.toString()).toBe('20')
      expect(creditFreight.toString()).toBe('20')
    })
  })

  it('refuses an unposted bill and over-allocation', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id,
        date: '2026-03-01',
        type: 'PURCHASE',
        sourceType: 'BILL',
        quantity: '10',
        unitCost: '10',
      })
      const draft = await tx.purchaseDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'BILL',
          number: 'BILL-DRAFT',
          date: new Date('2026-04-01'),
          status: 'DRAFT',
          subtotal: '10',
          taxTotal: '0',
          total: '10',
          currencyCode: 'USD',
          lines: {
            create: [
              {
                orgId: fixture.ctx.orgId,
                lineNumber: 1,
                description: 'Freight',
                quantity: '1',
                unitPrice: '10',
                amount: '10',
                expenseAccountId: fixture.accounts['5100'],
              },
            ],
          },
        },
        select: { id: true },
      })
      await expect(
        landedCostService.allocateInTx(tx, fixture.ctx, {
          billId: draft.id,
          lines: [{ itemId: item.id, amount: '10' }],
        }),
      ).rejects.toThrow(/posted/i)

      const bill = await postedFreightBill(tx, fixture, '15')
      await expect(
        landedCostService.allocateInTx(tx, fixture.ctx, {
          billId: bill.id,
          lines: [{ itemId: item.id, amount: '20' }],
        }),
      ).rejects.toThrow(/exceeds/i)
    })
  })
})

import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { resolvePostableCogsAccountId } from '@/server/accounting/chart-of-accounts'
import { positionOf, recordMovement } from '@/server/accounting/inventory'
import { postJournal } from '@/server/accounting/posting'
import { type Tx } from '@/server/db'
import { isAppError } from '@/server/errors'
import { postDocument as postSale } from '@/server/services/sales.service'
import { CODE, inRolledBackTransaction, makeOrg, type Fixture } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

async function customer(tx: Tx, fixture: Fixture) {
  return tx.customer.create({
    data: { orgId: fixture.ctx.orgId, displayName: `Cust ${Math.random().toString(36).slice(2, 7)}` },
    select: { id: true },
  })
}

async function inventoryItem(
  tx: Tx,
  fixture: Fixture,
  name: string,
  cogsAccountId: string,
) {
  return tx.item.create({
    data: {
      orgId: fixture.ctx.orgId,
      name,
      type: 'INVENTORY',
      salesPrice: '15',
      purchaseCost: '6',
      incomeAccountId: fixture.accounts[CODE.sales],
      inventoryAccountId: fixture.accounts['1200'],
      cogsAccountId,
    },
    select: { id: true },
  })
}

async function saleReceipt(tx: Tx, fixture: Fixture, customerId: string, itemId: string, number: string) {
  return tx.salesDocument.create({
    data: {
      orgId: fixture.ctx.orgId,
      type: 'SALES_RECEIPT',
      number,
      customerId,
      date: new Date('2026-04-01'),
      status: 'OPEN',
      subtotal: '15',
      taxTotal: '0',
      total: '15',
      currencyCode: 'USD',
      depositAccountId: fixture.accounts[CODE.bank],
      lines: {
        create: [
          {
            orgId: fixture.ctx.orgId,
            lineNumber: 1,
            itemId,
            quantity: '1',
            unitPrice: '15',
            amount: '15',
            incomeAccountId: fixture.accounts[CODE.sales],
          },
        ],
      },
    },
    select: { id: true },
  })
}

async function journalOf(tx: Tx, orgId: string, sourceId: string) {
  return tx.journal.findFirst({
    where: { orgId, sourceId, status: 'POSTED' },
    select: {
      lines: {
        select: {
          debit: true,
          credit: true,
          account: { select: { code: true } },
        },
      },
    },
  })
}

function side(
  journal: NonNullable<Awaited<ReturnType<typeof journalOf>>>,
  code: string,
  kind: 'debit' | 'credit',
) {
  return journal.lines
    .filter((line) => line.account.code === code)
    .reduce(
      (sum, line) => sum.plus((kind === 'debit' ? line.debit : line.credit).toString()),
      new Decimal(0),
    )
}

suite('QB-style COGS heading + detail', () => {
  it('posts a sale to the item leaf COGS, not the heading parent', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const leaf = await tx.ledgerAccount.create({
        data: {
          orgId: fixture.ctx.orgId,
          code: '5010',
          name: 'Merchandise COGS',
          type: 'COGS',
          subtype: 'COST_OF_GOODS_SOLD',
          parentId: fixture.accounts['5000'],
        },
        select: { id: true },
      })

      const buyer = await customer(tx, fixture)
      const item = await inventoryItem(tx, fixture, 'Valve', leaf.id)
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id,
        date: '2026-03-01',
        type: 'PURCHASE',
        sourceType: 'BILL',
        quantity: '5',
        unitCost: '6',
      })

      const doc = await saleReceipt(tx, fixture, buyer.id, item.id, 'SR-LEAF')
      await postSale(tx, fixture.ctx, doc.id)

      const journal = await journalOf(tx, fixture.ctx.orgId, doc.id)
      expect(journal).toBeTruthy()
      expect(side(journal!, '5010', 'debit').toString()).toBe('6')
      expect(side(journal!, '5000', 'debit').isZero()).toBe(true)
      expect(side(journal!, '1200', 'credit').toString()).toBe('6')
      expect((await positionOf(tx, item.id)).quantity.toString()).toBe('4')
    })
  })

  it('resolves a heading with exactly one postable child', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const leaf = await tx.ledgerAccount.create({
        data: {
          orgId: fixture.ctx.orgId,
          code: '5010',
          name: 'Only COGS detail',
          type: 'COGS',
          subtype: 'COST_OF_GOODS_SOLD',
          parentId: fixture.accounts['5000'],
        },
        select: { id: true },
      })

      const resolved = await resolvePostableCogsAccountId(tx, fixture.ctx.orgId, fixture.accounts['5000'])
      expect(resolved).toBe(leaf.id)

      const buyer = await customer(tx, fixture)
      const item = await inventoryItem(tx, fixture, 'Pipe', fixture.accounts['5000'])
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id,
        date: '2026-03-01',
        type: 'PURCHASE',
        sourceType: 'BILL',
        quantity: '2',
        unitCost: '6',
      })
      const doc = await saleReceipt(tx, fixture, buyer.id, item.id, 'SR-ONE')
      await postSale(tx, fixture.ctx, doc.id)
      const journal = await journalOf(tx, fixture.ctx.orgId, doc.id)
      expect(side(journal!, '5010', 'debit').toString()).toBe('6')
    })
  })

  it('refuses a heading with more than one postable child', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await tx.ledgerAccount.create({
        data: {
          orgId: fixture.ctx.orgId,
          code: '5010',
          name: 'COGS A',
          type: 'COGS',
          subtype: 'COST_OF_GOODS_SOLD',
          parentId: fixture.accounts['5000'],
        },
      })
      await tx.ledgerAccount.create({
        data: {
          orgId: fixture.ctx.orgId,
          code: '5020',
          name: 'COGS B',
          type: 'COGS',
          subtype: 'COST_OF_GOODS_SOLD',
          parentId: fixture.accounts['5000'],
        },
      })

      await expect(
        resolvePostableCogsAccountId(tx, fixture.ctx.orgId, fixture.accounts['5000']),
      ).rejects.toSatisfy((error: unknown) => {
        expect(isAppError(error)).toBe(true)
        expect(String(error)).toMatch(/grouping heading/i)
        return true
      })
    })
  })

  it('allows creating a main COGS heading and refuses posting to it', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)

      const main = await tx.ledgerAccount.create({
        data: {
          orgId: fixture.ctx.orgId,
          code: '5050',
          name: 'Other COGS section',
          type: 'COGS',
          subtype: 'COST_OF_GOODS_SOLD',
        },
        select: { id: true },
      })
      await tx.ledgerAccount.create({
        data: {
          orgId: fixture.ctx.orgId,
          code: '5051',
          name: 'Other COGS detail',
          type: 'COGS',
          subtype: 'COST_OF_GOODS_SOLD',
          parentId: main.id,
        },
      })

      await expect(
        postJournal(tx, fixture.ctx, {
          date: '2026-04-01',
          sourceType: 'MANUAL',
          lines: [
            { accountId: main.id, debit: '10' },
            { accountId: fixture.accounts[CODE.bank], credit: '10' },
          ],
        }),
      ).rejects.toThrow(/grouping heading/i)
    })
  })
})

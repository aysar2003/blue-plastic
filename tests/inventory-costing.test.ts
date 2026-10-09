import { afterAll, describe, expect, it } from 'vitest'

import {
  positionOf,
  recordMovement,
  reverseMovementsFor,
  stockAgreesWithLedger,
} from '@/server/accounting/inventory'
import { postJournal } from '@/server/accounting/posting'
import { db, type Tx } from '@/server/db'
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
      purchaseCost: '7.0000',
    },
    select: { id: true, name: true },
  })
}

suite('weighted-average costing', () => {
  it('averages two receipts at different prices', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)

      // 100 @ 10 = 1000, then 100 @ 20 = 2000. 200 units worth 3000, so 15 each.
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '100', unitCost: '10',
      })
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-05', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '100', unitCost: '20',
      })

      const position = await positionOf(tx, item.id)
      expect(position.quantity.toString()).toBe('200')
      expect(position.value.toString()).toBe('3000')
      expect(position.averageCost.toString()).toBe('15')

      const catalog = await tx.item.findUniqueOrThrow({
        where: { id: item.id },
        select: { purchaseCost: true },
      })
      expect(Number(catalog.purchaseCost)).toBe(15)
    })
  })

  it('issues at the average, which leaves the average unchanged', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)

      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '100', unitCost: '10',
      })
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-05', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '100', unitCost: '20',
      })

      const sale = await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-10', type: 'SALE', sourceType: 'INVOICE',
        quantity: '-50',
      })

      // Cost of sale is 50 x 15.
      expect(sale.unitCost.toString()).toBe('15')
      expect(sale.value.toString()).toBe('-750')

      const position = await positionOf(tx, item.id)
      expect(position.quantity.toString()).toBe('150')
      expect(position.value.toString()).toBe('2250')
      // The average is untouched by an issue. That is the property that makes
      // weighted average simple to keep right.
      expect(position.averageCost.toString()).toBe('15')
    })
  })

  it('handles a cost that does not divide evenly', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)

      // 3 @ 10 = 30. Average 10. Then 1 @ 11.
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '3', unitCost: '10',
      })
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-02', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '1', unitCost: '11',
      })

      const position = await positionOf(tx, item.id)
      expect(position.value.toString()).toBe('41')
      // 41 / 4 = 10.25 exactly.
      expect(position.averageCost.toString()).toBe('10.25')
    })
  })

  it('squeezes out rounding residue when stock returns to zero', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)

      // 3 @ 10 = 30, average 10. Sell 1 at a time: 10, 10, 10 — clean.
      // 3 @ 10.005 rounds each issue and would otherwise leave a cent behind.
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '3', unitCost: '3.3333',
      })
      for (let i = 0; i < 3; i++) {
        await recordMovement(tx, fixture.ctx, {
          itemId: item.id, date: '2026-03-02', type: 'SALE', sourceType: 'INVOICE', quantity: '-1',
        })
      }

      const position = await positionOf(tx, item.id)
      expect(position.quantity.toString()).toBe('0')
      // No stock must mean no value, or the residue sits in Inventory Asset for
      // ever attached to nothing.
      expect(position.value.toString()).toBe('0')
    })
  })

  it('refuses to sell stock that is not there', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      // New organisations allow negative stock. This case is the books that still refuse it.
      await tx.organization.update({
        where: { id: fixture.ctx.orgId },
        data: { allowNegativeStock: false },
      })
      const ctx = {
        ...fixture.ctx,
        organization: { ...fixture.ctx.organization, allowNegativeStock: false },
      }
      const item = await makeTrackedItem(tx, fixture)

      await recordMovement(tx, ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '5', unitCost: '10',
      })

      await expect(
        recordMovement(tx, ctx, {
          itemId: item.id, date: '2026-03-02', type: 'SALE', sourceType: 'INVOICE', quantity: '-6',
        }),
      ).rejects.toThrow(/in stock and this needs/i)
    })
  })

  it('allows negative stock when the organisation has asked for it, and trues up', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await tx.organization.update({
        where: { id: fixture.ctx.orgId },
        data: { allowNegativeStock: true },
      })
      const ctx = { ...fixture.ctx, organization: { ...fixture.ctx.organization, allowNegativeStock: true } }
      const item = await makeTrackedItem(tx, fixture)

      // Sold before anything was received: costed at the item's own purchase cost.
      const sale = await recordMovement(tx, ctx, {
        itemId: item.id, date: '2026-03-01', type: 'SALE', sourceType: 'INVOICE', quantity: '-2',
      })
      expect(sale.unitCost.toString()).toBe('7')

      const afterSale = await positionOf(tx, item.id)
      expect(afterSale.quantity.toString()).toBe('-2')

      // The receipt trues the position up.
      await recordMovement(tx, ctx, {
        itemId: item.id, date: '2026-03-05', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '10', unitCost: '9',
      })
      const after = await positionOf(tx, item.id)
      expect(after.quantity.toString()).toBe('8')
      // -14 + 90 = 76 across 8 units.
      expect(after.value.toString()).toBe('76')
    })
  })

  it('refuses a receipt with no cost', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)

      await expect(
        recordMovement(tx, fixture.ctx, {
          itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL', quantity: '5',
        }),
      ).rejects.toThrow(/needs a unit cost/i)
    })
  })

  it('refuses to move stock for an item that is not tracked', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const service = await tx.item.create({
        data: {
          orgId: fixture.ctx.orgId, name: 'Consulting', type: 'SERVICE',
          incomeAccountId: fixture.accounts[CODE.sales],
        },
        select: { id: true },
      })

      await expect(
        recordMovement(tx, fixture.ctx, {
          itemId: service.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
          quantity: '5', unitCost: '10',
        }),
      ).rejects.toThrow(/not a tracked item/i)
    })
  })
})

suite('the stock ledger is append-only', () => {
  it('refuses to change a movement', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)
      const movement = await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '10', unitCost: '5',
      })

      await expect(
        tx.$executeRaw`UPDATE inventory_transactions SET quantity = 999 WHERE id = ${movement.id}`,
      ).rejects.toThrow(/cannot be changed/i)
    })
  })

  it('refuses to delete a movement', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)
      const movement = await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '10', unitCost: '5',
      })

      await expect(
        tx.$executeRaw`DELETE FROM inventory_transactions WHERE id = ${movement.id}`,
      ).rejects.toThrow(/cannot be deleted/i)
    })
  })

  it('refuses a running total that does not follow from the one before', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '10', unitCost: '5',
      })

      // A bug in the costing engine would look exactly like this.
      await expect(
        tx.$executeRaw`
          INSERT INTO inventory_transactions
            (id, "orgId", "itemId", date, type, "sourceType", quantity, "unitCost", value,
             "runningQuantity", "runningValue", sequence)
          VALUES ('bad-run', ${fixture.ctx.orgId}, ${item.id}, '2026-03-02', 'PURCHASE', 'BILL',
                  5, 5, 25, 999, 75, 2)
        `,
      ).rejects.toThrow(/Running quantity is 999/i)
    })
  })

  it('refuses a gap in the sequence', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '10', unitCost: '5',
      })

      await expect(
        tx.$executeRaw`
          INSERT INTO inventory_transactions
            (id, "orgId", "itemId", date, type, "sourceType", quantity, "unitCost", value,
             "runningQuantity", "runningValue", sequence)
          VALUES ('gap', ${fixture.ctx.orgId}, ${item.id}, '2026-03-02', 'PURCHASE', 'BILL',
                  5, 5, 25, 15, 75, 7)
        `,
      ).rejects.toThrow(/must be consecutive/i)
    })
  })
})

suite('the stock ledger agrees with the general ledger', () => {
  it('stays equal to the Inventory Asset account through buying and selling', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)

      // Buy 100 @ 10, posting the value to Inventory Asset exactly as the
      // movement records it.
      const receipt = await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '100', unitCost: '10',
      })
      await postJournal(tx, fixture.ctx, {
        date: '2026-03-01', sourceType: 'BILL',
        lines: [
          { accountId: fixture.accounts['1200'], debit: receipt.value },
          { accountId: fixture.accounts[CODE.bank], credit: receipt.value },
        ],
      })

      let check = await stockAgreesWithLedger(tx, fixture.ctx.orgId)
      expect(check.stockValue.toString()).toBe('1000')
      expect(check.agrees).toBe(true)

      // Sell 30 at the average.
      const sale = await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-05', type: 'SALE', sourceType: 'INVOICE', quantity: '-30',
      })
      await postJournal(tx, fixture.ctx, {
        date: '2026-03-05', sourceType: 'INVOICE',
        lines: [
          { accountId: fixture.accounts['5000'], debit: sale.value.abs() },
          { accountId: fixture.accounts['1200'], credit: sale.value.abs() },
        ],
      })

      check = await stockAgreesWithLedger(tx, fixture.ctx.orgId)
      expect(check.stockValue.toString()).toBe('700')
      expect(check.ledgerBalance.toString()).toBe('700')
      expect(check.difference.toString()).toBe('0')
      expect(check.agrees).toBe(true)
    })
  })

  it('notices when they disagree', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)

      // A movement without its journal is exactly the bug this check exists for.
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '10', unitCost: '5',
      })

      const check = await stockAgreesWithLedger(tx, fixture.ctx.orgId)
      expect(check.stockValue.toString()).toBe('50')
      expect(check.ledgerBalance.toString()).toBe('0')
      expect(check.agrees).toBe(false)
      expect(check.difference.toString()).toBe('50')
    })
  })
})

afterAll(async () => {
  await db.$disconnect()
})

suite('linking a movement to its journal', () => {
  it('allows the journal to be set once, and nothing else', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)
      const movement = await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '10', unitCost: '5',
      })

      const journal = await postJournal(tx, fixture.ctx, {
        date: '2026-03-01', sourceType: 'BILL',
        lines: [
          { accountId: fixture.accounts['1200'], debit: '50' },
          { accountId: fixture.accounts[CODE.bank], credit: '50' },
        ],
      })

      // The cost has to be known before the journal can be built, so the movement
      // is written first. Recording which entry carried it is not a change to it.
      await expect(
        tx.$executeRaw`UPDATE inventory_transactions SET "journalId" = ${journal.id} WHERE id = ${movement.id}`,
      ).resolves.toBe(1)

      // But it cannot then be moved to a different entry.
      const other = await postJournal(tx, fixture.ctx, {
        date: '2026-03-02', sourceType: 'MANUAL',
        lines: [
          { accountId: fixture.accounts[CODE.rent], debit: '1' },
          { accountId: fixture.accounts[CODE.bank], credit: '1' },
        ],
      })
      await expect(
        tx.$executeRaw`UPDATE inventory_transactions SET "journalId" = ${other.id} WHERE id = ${movement.id}`,
      ).rejects.toThrow(/cannot be changed/i)
    })
  })

  it('still refuses a change that rides along with the journal link', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)
      const movement = await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        quantity: '10', unitCost: '5',
      })
      const journal = await postJournal(tx, fixture.ctx, {
        date: '2026-03-01', sourceType: 'BILL',
        lines: [
          { accountId: fixture.accounts['1200'], debit: '50' },
          { accountId: fixture.accounts[CODE.bank], credit: '50' },
        ],
      })

      await expect(
        tx.$executeRaw`
          UPDATE inventory_transactions
             SET "journalId" = ${journal.id}, quantity = 999
           WHERE id = ${movement.id}
        `,
      ).rejects.toThrow(/cannot be changed/i)
    })
  })
})

/**
 * Undoing a document.
 *
 * Voiding a bill reverses its journal, which takes the stock value back out of
 * the Inventory Asset account. Before `reverseMovementsFor` existed the stock
 * ledger kept the goods, so the two records of what the business owned
 * disagreed — and editing was worse, because the new movements were added on top
 * of the old ones and every edit inflated the stock.
 */
suite('reversing a document’s stock', () => {
  it('takes the goods back out at the cost they went in at', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)

      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        sourceId: 'bill-1', quantity: '100', unitCost: '10',
      })
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-05', type: 'PURCHASE', sourceType: 'BILL',
        sourceId: 'bill-2', quantity: '100', unitCost: '20',
      })

      const before = await positionOf(tx, item.id)
      expect(before.value.toString()).toBe('3000')

      const result = await reverseMovementsFor(tx, fixture.ctx, { sourceId: 'bill-2' })

      // Exactly what the second bill put in, so the journal reversal and the
      // stock reversal cancel to the same figure.
      expect(result.reversed).toBe(1)
      expect(result.value.toString()).toBe('-2000')

      const after = await positionOf(tx, item.id)
      expect(after.quantity.toString()).toBe('100')
      expect(after.value.toString()).toBe('1000')
      expect(after.averageCost.toString()).toBe('10')
    })
  })

  it('nets a document that carries the same item twice into one row', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)

      for (const quantity of ['10', '5']) {
        await recordMovement(tx, fixture.ctx, {
          itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
          sourceId: 'bill-1', quantity, unitCost: '4',
        })
      }

      const result = await reverseMovementsFor(tx, fixture.ctx, { sourceId: 'bill-1' })

      expect(result.reversed).toBe(1)
      expect(result.value.toString()).toBe('-60')

      const after = await positionOf(tx, item.id)
      expect(after.quantity.toString()).toBe('0')
      expect(after.value.toString()).toBe('0')
    })
  })

  it('is safe to call twice — an edited document still nets to nothing', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)

      // Received, edited (reverse then re-record), then voided (reverse again).
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        sourceId: 'bill-1', quantity: '10', unitCost: '4',
      })
      await reverseMovementsFor(tx, fixture.ctx, { sourceId: 'bill-1' })
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-02', type: 'PURCHASE', sourceType: 'BILL',
        sourceId: 'bill-1', quantity: '12', unitCost: '5',
      })

      const edited = await positionOf(tx, item.id)
      expect(edited.quantity.toString()).toBe('12')
      expect(edited.value.toString()).toBe('60')

      await reverseMovementsFor(tx, fixture.ctx, { sourceId: 'bill-1' })

      const voided = await positionOf(tx, item.id)
      expect(voided.quantity.toString()).toBe('0')
      expect(voided.value.toString()).toBe('0')
    })
  })

  it('lets stock go negative rather than trapping a wrong bill in the books', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const item = await makeTrackedItem(tx, fixture)

      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-01', type: 'PURCHASE', sourceType: 'BILL',
        sourceId: 'bill-1', quantity: '10', unitCost: '4',
      })
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id, date: '2026-03-02', type: 'SALE', sourceType: 'INVOICE',
        sourceId: 'invoice-1', quantity: '-8',
      })

      // The goods have been sold. Voiding the bill anyway is allowed: the ledger
      // records what happened, and the negative is the honest consequence.
      await reverseMovementsFor(tx, fixture.ctx, { sourceId: 'bill-1' })

      const after = await positionOf(tx, item.id)
      expect(after.quantity.toString()).toBe('-8')
    })
  })

  it('does nothing for a document that moved no stock', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await makeTrackedItem(tx, fixture)

      const result = await reverseMovementsFor(tx, fixture.ctx, { sourceId: 'nothing-here' })
      expect(result.reversed).toBe(0)
      expect(result.value.toString()).toBe('0')
    })
  })
})

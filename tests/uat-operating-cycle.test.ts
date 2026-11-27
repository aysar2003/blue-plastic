/**
 * Go-live UAT: buy (AP) → stock receive → sell invoice → TB balanced.
 * Rolled-back transaction — nothing is kept in production.
 *
 * Run: ALLOW_DB_TESTS=1 pnpm exec vitest run tests/uat-operating-cycle.test.ts
 */
import { describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { positionOf, recordMovement } from '@/server/accounting/inventory'
import { type Tx } from '@/server/db'
import { postDocument as postPurchase } from '@/server/services/purchase.service'
import { postDocument as postSale } from '@/server/services/sales.service'
import { CODE, inRolledBackTransaction, makeOrg, type Fixture } from './ledger-helpers'

const suite = process.env.DATABASE_URL && process.env.ALLOW_DB_TESTS === '1' ? describe : describe.skip

async function customer(tx: Tx, fixture: Fixture) {
  return tx.customer.create({
    data: {
      orgId: fixture.ctx.orgId,
      displayName: `UAT Buyer ${Math.random().toString(36).slice(2, 7)}`,
    },
    select: { id: true },
  })
}

async function vendor(tx: Tx, fixture: Fixture) {
  return tx.vendor.create({
    data: {
      orgId: fixture.ctx.orgId,
      displayName: `UAT Vendor ${Math.random().toString(36).slice(2, 7)}`,
    },
    select: { id: true },
  })
}

suite('UAT operating cycle (go-live)', () => {
  it('buy AP → stock → sell → journals balance', async () => {
    const report: string[] = []

    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      report.push(`org=${fixture.ctx.orgId}`)

      const buyer = await customer(tx, fixture)
      const supplier = await vendor(tx, fixture)
      const item = await tx.item.create({
        data: {
          orgId: fixture.ctx.orgId,
          name: 'UAT Widget',
          type: 'INVENTORY',
          salesPrice: '25',
          purchaseCost: '10',
          incomeAccountId: fixture.accounts[CODE.sales],
          inventoryAccountId: fixture.accounts['1200'],
          cogsAccountId: fixture.accounts['5000'],
        },
        select: { id: true },
      })
      report.push('master-data: customer + vendor + inventory item')

      // Buy side — expense bill (utilities) posts AP
      const bill = await tx.purchaseDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'BILL',
          number: 'UAT-BILL-1',
          vendorId: supplier.id,
          date: new Date('2026-04-01'),
          status: 'OPEN',
          subtotal: '40',
          taxTotal: '0',
          total: '40',
          currencyCode: 'USD',
          lines: {
            create: [
              {
                orgId: fixture.ctx.orgId,
                lineNumber: 1,
                quantity: '1',
                unitPrice: '40',
                amount: '40',
                expenseAccountId: fixture.accounts[CODE.utilities],
                description: 'UAT freight',
              },
            ],
          },
        },
        select: { id: true },
      })
      await postPurchase(tx, fixture.ctx, bill.id)
      report.push('buy: bill posted (AP)')

      // Stock receive
      await recordMovement(tx, fixture.ctx, {
        itemId: item.id,
        date: '2026-04-01',
        type: 'PURCHASE',
        sourceType: 'BILL',
        quantity: '10',
        unitCost: '10',
      })
      expect((await positionOf(tx, item.id)).quantity.toString()).toBe('10')
      report.push('stock: received 10 @ 10')

      // Sell invoice
      const invoice = await tx.salesDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'INVOICE',
          number: 'UAT-INV-1',
          customerId: buyer.id,
          date: new Date('2026-04-02'),
          dueDate: new Date('2026-04-30'),
          status: 'OPEN',
          subtotal: '50',
          taxTotal: '0',
          total: '50',
          currencyCode: 'USD',
          lines: {
            create: [
              {
                orgId: fixture.ctx.orgId,
                lineNumber: 1,
                itemId: item.id,
                quantity: '2',
                unitPrice: '25',
                amount: '50',
                incomeAccountId: fixture.accounts[CODE.sales],
              },
            ],
          },
        },
        select: { id: true },
      })
      await postSale(tx, fixture.ctx, invoice.id)
      report.push('sell: invoice posted (AR + COGS)')

      expect((await positionOf(tx, item.id)).quantity.toString()).toBe('8')
      report.push('stock: on hand 8 after sale')

      const journals = await tx.journal.findMany({
        where: { orgId: fixture.ctx.orgId, status: 'POSTED' },
        select: { lines: { select: { debit: true, credit: true } } },
      })
      expect(journals.length).toBeGreaterThanOrEqual(2)

      let debit = new Decimal(0)
      let credit = new Decimal(0)
      for (const journal of journals) {
        for (const line of journal.lines) {
          debit = debit.plus(line.debit.toString())
          credit = credit.plus(line.credit.toString())
        }
      }
      expect(debit.equals(credit)).toBe(true)
      report.push(`tb: balanced ${debit.toFixed(2)} = ${credit.toFixed(2)}`)

      const period = await tx.accountingPeriod.findFirst({ where: { orgId: fixture.ctx.orgId } })
      expect(period).toBeTruthy()
      report.push('periods: fiscal period present')
    })

    for (const line of report) {
      console.log(`[uat] ${line}`)
    }
  })
})

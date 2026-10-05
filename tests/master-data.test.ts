import { afterAll, describe, expect, it } from 'vitest'

import { Decimal } from '@/lib/money'
import { trialBalance } from '@/server/accounting/balances'
import { postJournal } from '@/server/accounting/posting'
import { db } from '@/server/db'
import { CODE, inRolledBackTransaction, makeOrg } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

/**
 * The exit criterion for this phase: a customer opening balance must land in
 * Accounts Receivable, carry the customer, and leave the ledger in balance.
 *
 * These go through the tables directly rather than the services, because the
 * services open their own transactions and could not then be rolled back. The
 * posting engine is the part that matters here, and it takes the caller's
 * transaction.
 */
suite('customer and vendor opening balances', () => {
  it('puts a customer opening balance into receivables, against opening balance equity', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const customer = await tx.customer.create({
        data: { orgId: ctx.orgId, displayName: 'Hodan Trading' },
        select: { id: true },
      })

      await postJournal(tx, ctx, {
        date: '2026-01-01',
        memo: 'Opening balance — Hodan Trading',
        sourceType: 'OPENING_BALANCE',
        sourceId: customer.id,
        lines: [
          { accountId: accounts[CODE.receivable], debit: '4500', customerId: customer.id },
          { accountId: accounts[CODE.openingBalanceEquity], credit: '4500' },
        ],
      })

      const report = await trialBalance(
        ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )
      expect(report.balanced).toBe(true)

      const receivable = report.rows.find((row) => row.code === CODE.receivable)
      expect(receivable?.closingDebit.toString()).toBe('4500')

      // And the same figure is reachable through the subledger, from the same rows.
      const line = await tx.journalLine.findFirst({
        where: { orgId: ctx.orgId, customerId: customer.id },
        select: { debit: true, accountId: true },
      })
      expect(line?.accountId).toBe(accounts[CODE.receivable])
      expect(new Decimal(line!.debit.toString()).toString()).toBe('4500')
    })
  })

  it('puts a vendor opening balance into payables', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const vendor = await tx.vendor.create({
        data: { orgId: ctx.orgId, displayName: 'Plastics Wholesale Ltd' },
        select: { id: true },
      })

      await postJournal(tx, ctx, {
        date: '2026-01-01',
        sourceType: 'OPENING_BALANCE',
        lines: [
          { accountId: accounts[CODE.openingBalanceEquity], debit: '1800' },
          { accountId: accounts[CODE.payable], credit: '1800', vendorId: vendor.id },
        ],
      })

      const report = await trialBalance(
        ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )
      const payable = report.rows.find((row) => row.code === CODE.payable)
      expect(payable?.closingCredit.toString()).toBe('1800')
      expect(report.balanced).toBe(true)
    })
  })

  it('posts a negative customer balance as a credit on receivables', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const customer = await tx.customer.create({
        data: { orgId: ctx.orgId, displayName: 'Credit Holder' },
        select: { id: true },
      })

      // Same shape postOpeningBalance uses for a signed -1200.
      await postJournal(tx, ctx, {
        date: '2026-01-01',
        memo: 'Opening credit — Credit Holder',
        sourceType: 'OPENING_BALANCE',
        sourceId: customer.id,
        lines: [
          { accountId: accounts[CODE.openingBalanceEquity], debit: '1200' },
          { accountId: accounts[CODE.receivable], credit: '1200', customerId: customer.id },
        ],
      })

      const report = await trialBalance(
        ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )
      expect(report.balanced).toBe(true)

      const line = await tx.journalLine.findFirst({
        where: { orgId: ctx.orgId, customerId: customer.id },
        select: { debit: true, credit: true, accountId: true },
      })
      expect(line?.accountId).toBe(accounts[CODE.receivable])
      expect(new Decimal(line!.credit.toString()).toString()).toBe('1200')
      expect(new Decimal(line!.debit.toString()).toString()).toBe('0')
    })
  })

  it('posts a negative vendor balance as a debit on payables', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const vendor = await tx.vendor.create({
        data: { orgId: ctx.orgId, displayName: 'Overpaid Supplier' },
        select: { id: true },
      })

      await postJournal(tx, ctx, {
        date: '2026-01-01',
        memo: 'Opening credit — Overpaid Supplier',
        sourceType: 'OPENING_BALANCE',
        sourceId: vendor.id,
        lines: [
          { accountId: accounts[CODE.payable], debit: '500', vendorId: vendor.id },
          { accountId: accounts[CODE.openingBalanceEquity], credit: '500' },
        ],
      })

      const report = await trialBalance(
        ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )
      expect(report.balanced).toBe(true)

      const line = await tx.journalLine.findFirst({
        where: { orgId: ctx.orgId, vendorId: vendor.id },
        select: { debit: true, credit: true, accountId: true },
      })
      expect(line?.accountId).toBe(accounts[CODE.payable])
      expect(new Decimal(line!.debit.toString()).toString()).toBe('500')
    })
  })

  it('still refuses a receivables line with no customer (R7)', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      await expect(
        postJournal(tx, ctx, {
          date: '2026-01-01',
          sourceType: 'OPENING_BALANCE',
          lines: [
            { accountId: accounts[CODE.receivable], debit: '100' },
            { accountId: accounts[CODE.openingBalanceEquity], credit: '100' },
          ],
        }),
      ).rejects.toThrow(/must name a customer/i)
    })
  })
})

suite('R9 — subledger dimensions cannot cross organisations', () => {
  it('refuses a line naming another organisation\'s customer', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await makeOrg(tx)
      const b = await makeOrg(tx)

      const foreignCustomer = await tx.customer.create({
        data: { orgId: b.ctx.orgId, displayName: 'Someone Else' },
        select: { id: true },
      })

      await expect(
        postJournal(tx, a.ctx, {
          date: '2026-01-01',
          sourceType: 'OPENING_BALANCE',
          lines: [
            { accountId: a.accounts[CODE.receivable], debit: '100', customerId: foreignCustomer.id },
            { accountId: a.accounts[CODE.openingBalanceEquity], credit: '100' },
          ],
        }),
      ).rejects.toThrow(/journal_lines_customer_org_fkey|foreign key/i)
    })
  })

  it('refuses a line naming another organisation\'s vendor', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await makeOrg(tx)
      const b = await makeOrg(tx)

      const foreignVendor = await tx.vendor.create({
        data: { orgId: b.ctx.orgId, displayName: 'Someone Else Ltd' },
        select: { id: true },
      })

      await expect(
        postJournal(tx, a.ctx, {
          date: '2026-01-01',
          sourceType: 'OPENING_BALANCE',
          lines: [
            { accountId: a.accounts[CODE.openingBalanceEquity], debit: '100' },
            { accountId: a.accounts[CODE.payable], credit: '100', vendorId: foreignVendor.id },
          ],
        }),
      ).rejects.toThrow(/journal_lines_vendor_org_fkey|foreign key/i)
    })
  })

  it('refuses to delete a contact that a posted line names', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)
      const customer = await tx.customer.create({
        data: { orgId: ctx.orgId, displayName: 'Pinned By History' },
        select: { id: true },
      })

      await postJournal(tx, ctx, {
        date: '2026-01-01',
        sourceType: 'OPENING_BALANCE',
        lines: [
          { accountId: accounts[CODE.receivable], debit: '10', customerId: customer.id },
          { accountId: accounts[CODE.openingBalanceEquity], credit: '10' },
        ],
      })

      await expect(
        tx.$executeRaw`DELETE FROM customers WHERE id = ${customer.id}`,
      ).rejects.toThrow(/foreign key|violates/i)
    })
  })
})

suite('item account mappings', () => {
  it('refuses an item whose income account is not an income account', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      await expect(
        tx.item.create({
          data: {
            orgId: ctx.orgId,
            name: 'Wrongly mapped',
            type: 'SERVICE',
            incomeAccountId: accounts[CODE.rent], // an expense account
          },
        }),
      ).rejects.toThrow(/income account must be an income account/i)
    })
  })

  it('refuses a tracked item with no inventory or COGS account', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      await expect(
        tx.item.create({
          data: {
            orgId: ctx.orgId,
            name: 'Untracked tracked item',
            type: 'INVENTORY',
            incomeAccountId: accounts[CODE.sales],
          },
        }),
      ).rejects.toThrow(/needs an income account, an inventory account and a cost of goods sold account/i)
    })
  })

  it('accepts a tracked item with all three mappings', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      const item = await tx.item.create({
        data: {
          orgId: ctx.orgId,
          name: 'Blue pipe, 25mm',
          sku: 'PIPE-25-BLUE',
          type: 'INVENTORY',
          incomeAccountId: accounts[CODE.sales],
          inventoryAccountId: accounts['1200'],
          cogsAccountId: accounts['5000'],
          salesPrice: '12.5000',
          purchaseCost: '7.2500',
        },
        select: { id: true, name: true },
      })

      expect(item.name).toBe('Blue pipe, 25mm')
    })
  })

  it('refuses an inventory account that is not an inventory account', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx, accounts } = await makeOrg(tx)

      await expect(
        tx.item.create({
          data: {
            orgId: ctx.orgId,
            name: 'Stock in the bank',
            type: 'INVENTORY',
            incomeAccountId: accounts[CODE.sales],
            inventoryAccountId: accounts[CODE.bank],
            cogsAccountId: accounts['5000'],
          },
        }),
      ).rejects.toThrow(/inventory account must be an account of the inventory type/i)
    })
  })
})

suite('tax definitions', () => {
  it('refuses a rate entered as a percentage instead of a fraction', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx } = await makeOrg(tx)
      const agency = await tx.taxAgency.create({
        data: { orgId: ctx.orgId, name: 'Revenue Authority' },
        select: { id: true },
      })

      // 16 instead of 0.16 would make every invoice wrong by a factor of a hundred.
      await expect(
        tx.taxRate.create({
          data: { orgId: ctx.orgId, name: 'VAT', rate: '16', agencyId: agency.id },
        }),
      ).rejects.toThrow(/tax_rates_fraction|violates check/i)
    })
  })

  it('accepts a fraction and keeps its precision', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx } = await makeOrg(tx)
      const agency = await tx.taxAgency.create({
        data: { orgId: ctx.orgId, name: 'Revenue Authority' },
        select: { id: true },
      })

      const rate = await tx.taxRate.create({
        data: { orgId: ctx.orgId, name: 'Levy', rate: '0.003330000', agencyId: agency.id },
        select: { rate: true },
      })

      expect(new Decimal(rate.rate.toString()).toString()).toBe('0.00333')
    })
  })
})

suite('payment terms', () => {
  it('allows only one default per organisation', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { ctx } = await makeOrg(tx)

      await tx.paymentTerm.create({
        data: { orgId: ctx.orgId, name: 'Net 30', type: 'NET_DAYS', dueDays: 30, isDefault: true },
      })

      await expect(
        tx.paymentTerm.create({
          data: { orgId: ctx.orgId, name: 'Net 60', type: 'NET_DAYS', dueDays: 60, isDefault: true },
        }),
      ).rejects.toThrow(/payment_terms_one_default|unique/i)
    })
  })
})

afterAll(async () => {
  await db.$disconnect()
})

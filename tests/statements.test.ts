import { afterAll, describe, expect, it } from 'vitest'

import { postJournal } from '@/server/accounting/posting'
import { balanceSheet, cashFlow, profitAndLoss } from '@/server/reports/statements'
import { db, type Tx } from '@/server/db'
import { CODE, inRolledBackTransaction, makeOrg, type Fixture } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

/** A small but complete set of books, so the statements have something to say. */
async function seedBooks(tx: Tx, fixture: Fixture) {
  const { ctx, accounts } = fixture

  // Owner puts in 50,000.
  await postJournal(tx, ctx, {
    date: '2026-01-02', memo: 'Capital introduced', sourceType: 'MANUAL',
    lines: [
      { accountId: accounts[CODE.bank], debit: '50000' },
      { accountId: accounts[CODE.capital], credit: '50000' },
    ],
  })

  // Buys equipment for 12,000.
  await postJournal(tx, ctx, {
    date: '2026-01-10', memo: 'Equipment', sourceType: 'MANUAL',
    lines: [
      { accountId: accounts['1400'], debit: '12000' },
      { accountId: accounts[CODE.bank], credit: '12000' },
    ],
  })

  // Buys stock on credit for 8,000.
  const vendor = await tx.vendor.create({
    data: { orgId: ctx.orgId, displayName: 'Plastics Supply Co' },
    select: { id: true },
  })
  await postJournal(tx, ctx, {
    date: '2026-02-01', memo: 'Stock purchased', sourceType: 'MANUAL',
    lines: [
      { accountId: accounts['1200'], debit: '8000' },
      { accountId: accounts[CODE.payable], credit: '8000', vendorId: vendor.id },
    ],
  })

  // Sells for 30,000 on credit, costing 6,000.
  const customer = await tx.customer.create({
    data: { orgId: ctx.orgId, displayName: 'Hodan Trading' },
    select: { id: true },
  })
  await postJournal(tx, ctx, {
    date: '2026-03-01', memo: 'Sales', sourceType: 'INVOICE',
    lines: [
      { accountId: accounts[CODE.receivable], debit: '30000', customerId: customer.id },
      { accountId: accounts[CODE.sales], credit: '30000' },
      { accountId: accounts['5000'], debit: '6000' },
      { accountId: accounts['1200'], credit: '6000' },
    ],
  })

  // Collects 18,000 of it.
  await postJournal(tx, ctx, {
    date: '2026-03-20', memo: 'Payment received', sourceType: 'CUSTOMER_PAYMENT',
    lines: [
      { accountId: accounts[CODE.bank], debit: '18000' },
      { accountId: accounts[CODE.receivable], credit: '18000', customerId: customer.id },
    ],
  })

  // Rent and depreciation.
  await postJournal(tx, ctx, {
    date: '2026-03-31', memo: 'Rent', sourceType: 'MANUAL',
    lines: [
      { accountId: accounts[CODE.rent], debit: '4000' },
      { accountId: accounts[CODE.bank], credit: '4000' },
    ],
  })
  await postJournal(tx, ctx, {
    date: '2026-03-31', memo: 'Depreciation', sourceType: 'MANUAL', isAdjusting: true,
    lines: [
      { accountId: accounts['7000'], debit: '1000' },
      { accountId: accounts['1450'], credit: '1000' },
    ],
  })

  return { customer, vendor }
}

suite('profit and loss', () => {
  it('reads income, cost of sales and gross profit the way an accountant does', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await seedBooks(tx, fixture)

      const report = await profitAndLoss(
        fixture.ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )

      // Revenue reads positive even though it is a credit balance.
      expect(report.totalIncome.toString()).toBe('30000')
      expect(report.totalCogs.toString()).toBe('6000')
      expect(report.grossProfit.toString()).toBe('24000')
      // Rent 4,000 plus depreciation 1,000.
      expect(report.totalOperatingExpenses.toString()).toBe('5000')
      expect(report.netIncome.toString()).toBe('19000')
    })
  })

  it('shows each line as a share of income', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await seedBooks(tx, fixture)

      const report = await profitAndLoss(
        fixture.ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )

      const cogs = report.sections.find((s) => s.key === 'cogs')!.rows[0]
      expect(cogs.percentOfIncome?.toString()).toBe('20')
    })
  })

  it('reports nothing outside the range', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await seedBooks(tx, fixture)

      const january = await profitAndLoss(
        fixture.ctx.orgId,
        { from: '2026-01-01', to: '2026-01-31' },
        { client: tx },
      )
      expect(january.totalIncome.toString()).toBe('0')
      expect(january.netIncome.toString()).toBe('0')
    })
  })

  it('compares against another period', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await seedBooks(tx, fixture)

      const report = await profitAndLoss(
        fixture.ctx.orgId,
        { from: '2026-03-01', to: '2026-03-31' },
        { client: tx, comparison: { from: '2026-02-01', to: '2026-02-28' } },
      )

      expect(report.netIncome.toString()).toBe('19000')
      expect(report.comparison?.netIncome.toString()).toBe('0')
    })
  })
})

suite('balance sheet', () => {
  it('balances, and its accumulated profit equals the profit and loss', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await seedBooks(tx, fixture)

      const sheet = await balanceSheet(fixture.ctx.orgId, '2026-12-31', { client: tx })
      const pnl = await profitAndLoss(
        fixture.ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )

      // Bank 52,000 + AR 12,000 + stock 2,000 + equipment 12,000 − depreciation 1,000
      expect(sheet.totalAssets.toString()).toBe('77000')
      expect(sheet.totalLiabilities.toString()).toBe('8000')
      expect(sheet.postedEquity.toString()).toBe('50000')
      expect(sheet.accumulatedProfit.toString()).toBe(pnl.netIncome.toString())
      expect(sheet.totalEquity.toString()).toBe('69000')

      // The only assertion that really matters.
      expect(sheet.difference.toString()).toBe('0')
      expect(sheet.balanced).toBe(true)
    })
  })

  it('balances at any date, not only at the end', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await seedBooks(tx, fixture)

      for (const asOf of ['2026-01-05', '2026-01-31', '2026-02-15', '2026-03-15', '2026-03-31']) {
        const sheet = await balanceSheet(fixture.ctx.orgId, asOf, { client: tx })
        expect(sheet.balanced, `unbalanced at ${asOf}`).toBe(true)
      }
    })
  })

  it('balances on an empty set of books', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const sheet = await balanceSheet(fixture.ctx.orgId, '2026-12-31', { client: tx })
      expect(sheet.totalAssets.toString()).toBe('0')
      expect(sheet.balanced).toBe(true)
    })
  })
})

suite('cash flow', () => {
  it('explains the actual movement in cash, exactly', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await seedBooks(tx, fixture)

      const report = await cashFlow(
        fixture.ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )

      // 50,000 in − 12,000 equipment + 18,000 collected − 4,000 rent
      expect(report.openingCash.toString()).toBe('0')
      expect(report.closingCash.toString()).toBe('52000')
      expect(report.netChange.toString()).toBe('52000')

      // The statement's own check. A cash flow that does not tie to the bank is
      // the commonest fault in a set of accounts; this one cannot have it.
      expect(report.difference.toString()).toBe('0')
      expect(report.reconciles).toBe(true)
    })
  })

  it('starts from net income and adjusts for working capital', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await seedBooks(tx, fixture)

      const report = await cashFlow(
        fixture.ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )

      expect(report.netIncome.toString()).toBe('19000')
      // Receivables rose by 12,000, which is profit that has not arrived.
      const receivables = report.operating.lines.find((line) => line.label.includes('Accounts Receivable'))
      expect(receivables?.amount.toString()).toBe('-12000')
      // Depreciation is a non-cash charge, so it comes back in operating rather
      // than netting against the asset in investing.
      const depreciation = report.operating.lines.find((line) => line.label.includes('Accumulated'))
      expect(depreciation?.amount.toString()).toBe('1000')
      // Investing shows what was actually spent on assets.
      expect(report.investing.total.toString()).toBe('-12000')
      // Capital introduced is financing.
      expect(report.financing.total.toString()).toBe('50000')
    })
  })

  it('reconciles over any sub-period', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await seedBooks(tx, fixture)

      for (const range of [
        { from: '2026-01-01', to: '2026-01-31' },
        { from: '2026-02-01', to: '2026-02-28' },
        { from: '2026-03-01', to: '2026-03-31' },
        { from: '2026-02-15', to: '2026-03-15' },
      ]) {
        const report = await cashFlow(fixture.ctx.orgId, range, { client: tx })
        expect(report.reconciles, `did not reconcile for ${range.from}..${range.to}`).toBe(true)
      }
    })
  })

  it('returns comparison totals when a prior period is requested', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await seedBooks(tx, fixture)

      const report = await cashFlow(
        fixture.ctx.orgId,
        { from: '2026-02-01', to: '2026-02-28' },
        {
          client: tx,
          comparison: { from: '2026-01-01', to: '2026-01-31' },
        },
      )

      expect(report.comparison).toBeDefined()
      expect(report.comparison?.netChange).toBeDefined()
      expect(report.comparison?.openingCash).toBeDefined()
      expect(report.comparison?.closingCash).toBeDefined()
      expect(report.operating.comparisonTotal).toBeDefined()
      expect(report.reconciles).toBe(true)
    })
  })
})

suite('cash basis', () => {
  it('counts only what moved through a bank account', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await seedBooks(tx, fixture)

      const accrual = await profitAndLoss(
        fixture.ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31' },
        { client: tx },
      )
      const cash = await profitAndLoss(
        fixture.ctx.orgId,
        { from: '2026-01-01', to: '2026-12-31', basis: 'cash' },
        { client: tx },
      )

      // The sale was invoiced, not banked, so it is income on the accrual basis
      // and nothing at all on the cash basis.
      expect(accrual.totalIncome.toString()).toBe('30000')
      expect(cash.totalIncome.toString()).toBe('0')
      // Rent was paid, so it appears on both.
      expect(cash.totalOperatingExpenses.toString()).toBe('4000')
    })
  })
})

afterAll(async () => {
  await db.$disconnect()
})

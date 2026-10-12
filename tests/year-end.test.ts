import { afterAll, describe, expect, it } from 'vitest'

import { closeYear, closingPreview, reopenYear } from '@/server/accounting/close'
import { closeChecklist } from '@/server/accounting/close-checklist'
import { postJournal } from '@/server/accounting/posting'
import { balanceSheet, profitAndLoss } from '@/server/reports/statements'
import { db, type Tx } from '@/server/db'
import { CODE, inRolledBackTransaction, makeOrg, type Fixture } from './ledger-helpers'

const suite = process.env.DATABASE_URL ? describe : describe.skip

const YEAR_2026 = { from: '2026-01-01', to: '2026-12-31' }

/** Capital in, one sale, one expense: profit of 7,000 for 2026. */
async function tradeFor2026(tx: Tx, fixture: Fixture) {
  const { ctx, accounts } = fixture

  await postJournal(tx, ctx, {
    date: '2026-01-02', memo: 'Capital', sourceType: 'MANUAL',
    lines: [
      { accountId: accounts[CODE.bank], debit: '20000' },
      { accountId: accounts[CODE.capital], credit: '20000' },
    ],
  })
  await postJournal(tx, ctx, {
    date: '2026-05-10', memo: 'Sale', sourceType: 'MANUAL',
    lines: [
      { accountId: accounts[CODE.bank], debit: '10000' },
      { accountId: accounts[CODE.sales], credit: '10000' },
    ],
  })
  await postJournal(tx, ctx, {
    date: '2026-06-30', memo: 'Rent', sourceType: 'MANUAL',
    lines: [
      { accountId: accounts[CODE.rent], debit: '3000' },
      { accountId: accounts[CODE.bank], credit: '3000' },
    ],
  })
}

async function fiscalYearId(tx: Tx, orgId: string, year: number) {
  const row = await tx.fiscalYear.findFirstOrThrow({
    where: { orgId, year },
    select: { id: true },
  })
  return row.id
}

suite('the closing entry', () => {
  it('takes every income and expense account to zero and puts the profit in retained earnings', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await tradeFor2026(tx, fixture)

      const yearId = await fiscalYearId(tx, fixture.ctx.orgId, 2026)
      const preview = await closingPreview(tx, fixture.ctx, yearId)

      // Sales 10,000 credit and rent 3,000 debit.
      expect(preview.lines).toHaveLength(2)
      expect(preview.netIncome.toString()).toBe('7000')

      await closeYear(tx, fixture.ctx, yearId)

      // Every nominal account now carries a zero balance. Asked of the ledger
      // directly, because the profit and loss deliberately looks past the
      // closing entry and would answer the question it was not asked.
      const nominal = await tx.$queryRaw<{ balance: string }[]>`
        SELECT COALESCE(SUM(l.debit - l.credit), 0) AS balance
          FROM journal_lines l
          JOIN ledger_accounts a ON a.id = l."accountId"
         WHERE l."orgId" = ${fixture.ctx.orgId} AND a.type IN ('REVENUE', 'COGS', 'EXPENSE')
      `
      expect(String(nominal[0].balance)).toBe('0')

      const retained = await tx.$queryRaw<{ balance: string }[]>`
        SELECT COALESCE(SUM(l.credit - l.debit), 0) AS balance
          FROM journal_lines l
          JOIN ledger_accounts a ON a.id = l."accountId"
         WHERE l."orgId" = ${fixture.ctx.orgId} AND a."systemKey" = 'RETAINED_EARNINGS'
      `
      expect(String(retained[0].balance)).toBe('7000')
    })
  })

  it('is dated at the year end, so the year it closes still reports its own profit', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await tradeFor2026(tx, fixture)

      const yearId = await fiscalYearId(tx, fixture.ctx.orgId, 2026)
      const before = await profitAndLoss(fixture.ctx.orgId, YEAR_2026, { client: tx })
      await closeYear(tx, fixture.ctx, yearId)
      const after = await profitAndLoss(fixture.ctx.orgId, YEAR_2026, { client: tx })

      // 9.5: the comparative for a closed year has to survive the close.
      expect(before.netIncome.toString()).toBe('7000')
      expect(after.netIncome.toString()).toBe('7000')
      expect(after.totalIncome.toString()).toBe(before.totalIncome.toString())
    })
  })

  it('leaves the balance sheet identical, before and after', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await tradeFor2026(tx, fixture)

      const yearId = await fiscalYearId(tx, fixture.ctx.orgId, 2026)
      const before = await balanceSheet(fixture.ctx.orgId, '2026-12-31', { client: tx })
      await closeYear(tx, fixture.ctx, yearId)
      const after = await balanceSheet(fixture.ctx.orgId, '2026-12-31', { client: tx })

      // The profit moves from the nominal accounts into Retained Earnings, which
      // is a move within equity. Nothing else can change.
      expect(after.totalAssets.toString()).toBe(before.totalAssets.toString())
      expect(after.totalEquity.toString()).toBe(before.totalEquity.toString())
      expect(before.accumulatedProfit.toString()).toBe('7000')
      expect(after.accumulatedProfit.toString()).toBe('0')
      expect(after.postedEquity.toString()).toBe('27000')
      expect(after.balanced).toBe(true)
    })
  })

  it('locks the year and all of its periods', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await tradeFor2026(tx, fixture)

      const yearId = await fiscalYearId(tx, fixture.ctx.orgId, 2026)
      const result = await closeYear(tx, fixture.ctx, yearId)

      expect(result.periodsLocked).toBe(13)

      const year = await tx.fiscalYear.findUniqueOrThrow({
        where: { id: yearId },
        select: { status: true, closedAt: true, closingJournalId: true },
      })
      expect(year.status).toBe('LOCKED')
      expect(year.closedAt).not.toBeNull()
      expect(year.closingJournalId).toBe(result.journal!.id)

      const open = await tx.accountingPeriod.count({
        where: { fiscalYearId: yearId, status: { not: 'LOCKED' } },
      })
      expect(open).toBe(0)
    })
  })

  it('refuses to post into the year once it is closed', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const { ctx, accounts } = fixture
      await tradeFor2026(tx, fixture)
      const yearId = await fiscalYearId(tx, ctx.orgId, 2026)
      await closeYear(tx, ctx, yearId)

      await expect(
        postJournal(tx, ctx, {
          date: '2026-07-01', memo: 'Too late', sourceType: 'MANUAL',
          lines: [
            { accountId: accounts[CODE.rent], debit: '100' },
            { accountId: accounts[CODE.bank], credit: '100' },
          ],
        }),
      ).rejects.toThrow(/locked/i)
    })
  })

  it('will not close the same year twice', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await tradeFor2026(tx, fixture)
      const yearId = await fiscalYearId(tx, fixture.ctx.orgId, 2026)

      await closeYear(tx, fixture.ctx, yearId)
      await expect(closeYear(tx, fixture.ctx, yearId)).rejects.toThrow(/already been closed/i)
    })
  })

  it('closes a year with nothing in it without posting an empty journal', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      // Touch 2026 so its periods exist, but post nothing to the ledger.
      await postJournal(tx, fixture.ctx, {
        date: '2026-01-02', memo: 'Capital', sourceType: 'MANUAL',
        lines: [
          { accountId: fixture.accounts[CODE.bank], debit: '1000' },
          { accountId: fixture.accounts[CODE.capital], credit: '1000' },
        ],
      })

      const yearId = await fiscalYearId(tx, fixture.ctx.orgId, 2026)
      const result = await closeYear(tx, fixture.ctx, yearId)

      // Nothing to sweep: no journal, but the year still locks.
      expect(result.journal).toBeNull()
      expect(result.periodsLocked).toBe(13)
    })
  })
})

suite('reopening a closed year', () => {
  it('reverses the closing entry rather than deleting it', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await tradeFor2026(tx, fixture)
      const yearId = await fiscalYearId(tx, fixture.ctx.orgId, 2026)

      const closed = await closeYear(tx, fixture.ctx, yearId)
      const { reversal } = await reopenYear(tx, fixture.ctx, yearId, 'Depreciation was missed')

      expect(reversal).not.toBeNull()

      // R4 holds: the original is still there, marked reversed.
      const original = await tx.journal.findUniqueOrThrow({
        where: { id: closed.journal!.id },
        select: { status: true },
      })
      expect(original.status).toBe('REVERSED')

      const year = await tx.fiscalYear.findUniqueOrThrow({
        where: { id: yearId },
        select: { status: true, closedAt: true, closingJournalId: true },
      })
      expect(year.status).toBe('OPEN')
      expect(year.closedAt).toBeNull()
      expect(year.closingJournalId).toBeNull()
    })
  })

  it('puts the profit back where it was, exactly', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await tradeFor2026(tx, fixture)
      const yearId = await fiscalYearId(tx, fixture.ctx.orgId, 2026)

      const before = await profitAndLoss(fixture.ctx.orgId, YEAR_2026, { client: tx })
      await closeYear(tx, fixture.ctx, yearId)
      await reopenYear(tx, fixture.ctx, yearId, 'Reopened for an adjustment')
      const after = await profitAndLoss(fixture.ctx.orgId, YEAR_2026, { client: tx })

      expect(after.netIncome.toString()).toBe(before.netIncome.toString())
      expect(after.totalIncome.toString()).toBe('10000')

      const sheet = await balanceSheet(fixture.ctx.orgId, '2026-12-31', { client: tx })
      expect(sheet.accumulatedProfit.toString()).toBe('7000')
      expect(sheet.balanced).toBe(true)
    })
  })

  it('lets the year be posted to and closed again', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const { ctx, accounts } = fixture
      await tradeFor2026(tx, fixture)
      const yearId = await fiscalYearId(tx, ctx.orgId, 2026)

      await closeYear(tx, ctx, yearId)
      await reopenYear(tx, ctx, yearId, 'Depreciation was missed')

      await postJournal(tx, ctx, {
        date: '2026-12-31', memo: 'Depreciation', sourceType: 'MANUAL', isAdjusting: true,
        lines: [
          { accountId: accounts['7000'], debit: '1000' },
          { accountId: accounts['1450'], credit: '1000' },
        ],
      })

      const second = await closeYear(tx, ctx, yearId)
      expect(second.preview.netIncome.toString()).toBe('6000')

      const after = await profitAndLoss(ctx.orgId, YEAR_2026, { client: tx })
      expect(after.netIncome.toString()).toBe('6000')

      const sheet = await balanceSheet(ctx.orgId, '2026-12-31', { client: tx })
      expect(sheet.balanced).toBe(true)
    })
  })

  it('refuses to reopen a year that is not closed', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await tradeFor2026(tx, fixture)
      const yearId = await fiscalYearId(tx, fixture.ctx.orgId, 2026)

      await expect(reopenYear(tx, fixture.ctx, yearId, 'why not')).rejects.toThrow(/not closed/i)
    })
  })
})

suite('the close checklist', () => {
  it('passes on books that agree with themselves', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      await tradeFor2026(tx, fixture)

      const checklist = await closeChecklist(
        fixture.ctx,
        { from: '2026-01-01', to: '2026-01-31' },
        { client: tx },
      )

      expect(checklist.blocked).toBe(false)
      const failing = checklist.checks.filter((check) => check.severity !== 'ok').map((c) => c.key)
      // A brand-new org has never reconciled a bank account, which is a fair
      // thing to point out and not a reason to refuse the close.
      expect(failing).toEqual(['reconciliation'])
    })
  })

  it('notices money received but not banked', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const { ctx, accounts } = fixture

      await postJournal(tx, ctx, {
        date: '2026-03-01', memo: 'Cash sale, not yet banked', sourceType: 'MANUAL',
        lines: [
          { accountId: accounts['1050'], debit: '500' },
          { accountId: accounts[CODE.sales], credit: '500' },
        ],
      })

      const checklist = await closeChecklist(
        ctx,
        { from: '2026-03-01', to: '2026-03-31' },
        { client: tx },
      )

      const undeposited = checklist.checks.find((check) => check.key === 'undeposited')!
      expect(undeposited.severity).toBe('warning')
      expect(undeposited.amount?.toString()).toBe('500')
      // A warning is not a blocker.
      expect(checklist.blocked).toBe(false)
    })
  })

  it('notices a draft dated inside the period', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await makeOrg(tx)
      const customer = await tx.customer.create({
        data: { orgId: fixture.ctx.orgId, displayName: 'Hodan Trading' },
        select: { id: true },
      })
      await tx.salesDocument.create({
        data: {
          orgId: fixture.ctx.orgId,
          type: 'INVOICE',
          number: 'INV-DRAFT',
          customerId: customer.id,
          date: new Date('2026-03-15'),
          status: 'DRAFT',
          currencyCode: 'USD',
          subtotal: 100,
          total: 100,
        },
      })

      const checklist = await closeChecklist(
        fixture.ctx,
        { from: '2026-03-01', to: '2026-03-31' },
        { client: tx },
      )

      const drafts = checklist.checks.find((check) => check.key === 'drafts')!
      expect(drafts.severity).toBe('warning')
      expect(drafts.count).toBe(1)
    })
  })
})

afterAll(async () => {
  await db.$disconnect()
})
